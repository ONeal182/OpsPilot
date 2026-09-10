<?php

namespace App\Messaging;

use PhpAmqpLib\Channel\AMQPChannel;
use PhpAmqpLib\Connection\AMQPStreamConnection;
use PhpAmqpLib\Wire\AMQPTable;

/**
 * Thin wrapper around a php-amqplib connection + channel for the OpsPilot event
 * bus.
 *
 * The connection and channel are opened lazily on first use. {@see declareTopology()}
 * asserts the exact same exchange / queue / binding set as the Node agent's
 * services/agent/src/messaging/topology.ts (assertTopology). All declarations are
 * idempotent and MUST match the Node side (exchange type, durability and every
 * `x-` argument) or RabbitMQ answers 406 PRECONDITION_FAILED.
 */
class RabbitMqConnection
{
    private ?AMQPStreamConnection $connection = null;

    private ?AMQPChannel $channel = null;

    /**
     * @param  array<string, mixed>  $config  the `opspilot.messaging` config array
     */
    public function __construct(private readonly array $config) {}

    /**
     * Lazily open (and reuse) a single channel.
     */
    public function channel(): AMQPChannel
    {
        if ($this->channel instanceof AMQPChannel) {
            return $this->channel;
        }

        /** @var array<string, mixed> $rabbit */
        $rabbit = $this->config['rabbitmq'];

        $this->connection = new AMQPStreamConnection(
            (string) $rabbit['host'],
            (int) $rabbit['port'],
            (string) $rabbit['user'],
            (string) $rabbit['password'],
            (string) $rabbit['vhost'],
        );

        return $this->channel = $this->connection->channel();
    }

    /**
     * Idempotently declare the shared topology. Mirrors assertTopology() in
     * services/agent/src/messaging/topology.ts one-to-one:
     *
     *  - exchange `opspilot.events`  — topic, durable
     *  - exchange `opspilot.dlx`     — topic, durable
     *  - queue    `agent.analysis.requested.dlq`  — durable, bound to the DLX with `#`
     *  - queue    `agent.analysis.requested`      — durable, args
     *      x-dead-letter-exchange   = opspilot.dlx
     *      x-dead-letter-routing-key = agent.analysis.requested.dlq
     *    bound to `opspilot.events` with routing key `agent.analysis.requested`
     */
    public function declareTopology(): void
    {
        $channel = $this->channel();

        $exchange = (string) $this->config['exchange'];
        $dlx = (string) $this->config['dlx'];
        $queue = (string) $this->config['analysis_queue'];
        $dlq = (string) $this->config['dlq'];
        $routingKey = (string) $this->config['analysis_routing_key'];

        // Primary + dead-letter exchanges: topic, durable (passive=false,
        // durable=true, auto_delete=false) — matches
        // channel.assertExchange(name, 'topic', { durable: true }).
        $channel->exchange_declare($exchange, 'topic', false, true, false);
        $channel->exchange_declare($dlx, 'topic', false, true, false);

        // Dead-letter queue: durable, no args; catch-all bound to the DLX.
        $channel->queue_declare($dlq, false, true, false, false);
        $channel->queue_bind($dlq, $dlx, '#');

        // Work queue: durable, dead-letters to the DLX. The two arguments match
        // amqplib's { deadLetterExchange, deadLetterRoutingKey } options exactly.
        $arguments = new AMQPTable([
            'x-dead-letter-exchange' => $dlx,
            'x-dead-letter-routing-key' => $dlq,
        ]);
        $channel->queue_declare($queue, false, true, false, false, false, $arguments);
        $channel->queue_bind($queue, $exchange, $routingKey);
    }

    /**
     * Close the channel and connection if they were opened.
     */
    public function close(): void
    {
        if ($this->channel instanceof AMQPChannel) {
            $this->channel->close();
            $this->channel = null;
        }

        if ($this->connection instanceof AMQPStreamConnection) {
            $this->connection->close();
            $this->connection = null;
        }
    }
}
