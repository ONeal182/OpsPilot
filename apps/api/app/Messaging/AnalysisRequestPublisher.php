<?php

namespace App\Messaging;

use Illuminate\Support\Str;
use InvalidArgumentException;
use PhpAmqpLib\Message\AMQPMessage;

/**
 * Publishes `AnalysisRequest` messages onto the OpsPilot event bus.
 *
 * The payload is ALWAYS JSON-encoded (UTF-8). PHP `serialize()` / Laravel's
 * serialized job payloads are NEVER used on this boundary — the Node Agent
 * Runtime cannot read PHP-serialized data. See docs/contracts/messaging.md and
 * docs/DECISIONS.md D3.
 *
 * `buildEnvelope()` / `encode()` / `validate()` are pure (no I/O) so they can be
 * unit-tested without a live broker.
 */
class AnalysisRequestPublisher
{
    /**
     * @param  array<string, mixed>  $config  the `opspilot.messaging` config array
     */
    public function __construct(
        private readonly RabbitMqConnection $connection,
        private readonly array $config,
    ) {}

    /**
     * Validate, JSON-encode and publish an AnalysisRequest.
     *
     * @param  array<string, mixed>  $request
     *
     * @throws InvalidArgumentException on a malformed payload
     * @throws \JsonException on an unencodable payload
     */
    public function publish(array $request): void
    {
        $json = $this->encode($request);

        $this->connection->declareTopology();

        $ticketId = (string) $request['ticketId'];
        $correlationId = isset($request['correlationId']) && is_string($request['correlationId']) && $request['correlationId'] !== ''
            ? $request['correlationId']
            : (string) Str::uuid();

        $message = new AMQPMessage($json, [
            'content_type' => 'application/json',
            'delivery_mode' => AMQPMessage::DELIVERY_MODE_PERSISTENT,
            'message_id' => $ticketId,
            'correlation_id' => $correlationId,
            'timestamp' => time(),
        ]);

        $this->connection->channel()->basic_publish(
            $message,
            (string) $this->config['exchange'],
            (string) $this->config['analysis_routing_key'],
        );
    }

    /**
     * Validate + JSON-encode an AnalysisRequest. Pure: no broker I/O.
     *
     * @param  array<string, mixed>  $request
     *
     * @throws InvalidArgumentException on a malformed payload
     * @throws \JsonException on an unencodable payload
     */
    public function encode(array $request): string
    {
        $this->validate($request);

        return json_encode($request, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);
    }

    /**
     * Assert the AnalysisRequest shape from docs/contracts/messaging.md:
     * `ticketId` non-empty string, `payload` array/object, `requestedAt` ISO
     * date-time string. `source` / `correlationId` are optional.
     *
     * @param  array<string, mixed>  $request
     *
     * @throws InvalidArgumentException
     */
    public function validate(array $request): void
    {
        $ticketId = $request['ticketId'] ?? null;
        if (! is_string($ticketId) || $ticketId === '') {
            throw new InvalidArgumentException('AnalysisRequest.ticketId must be a non-empty string.');
        }

        if (! array_key_exists('payload', $request) || ! is_array($request['payload'])) {
            throw new InvalidArgumentException('AnalysisRequest.payload must be an array/object.');
        }

        $requestedAt = $request['requestedAt'] ?? null;
        if (! is_string($requestedAt) || $requestedAt === '' || strtotime($requestedAt) === false) {
            throw new InvalidArgumentException('AnalysisRequest.requestedAt must be an ISO-8601 date-time string.');
        }

        if (array_key_exists('source', $request) && ! is_string($request['source'])) {
            throw new InvalidArgumentException('AnalysisRequest.source must be a string when present.');
        }

        if (array_key_exists('correlationId', $request) && ! is_string($request['correlationId'])) {
            throw new InvalidArgumentException('AnalysisRequest.correlationId must be a string when present.');
        }
    }
}
