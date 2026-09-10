<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Messaging (RabbitMQ)
    |--------------------------------------------------------------------------
    |
    | The OpsPilot event bus. The Laravel publisher and the Node Agent Runtime
    | (services/agent) share ONE topology definition — the single source of
    | truth is docs/contracts/messaging.md and
    | services/agent/src/messaging/topology.ts. Every name/type/argument here
    | MUST match the Node side byte-for-byte or RabbitMQ returns
    | 406 PRECONDITION_FAILED on a mismatched redeclare.
    |
    | Values are read from env (root `.env` is injected into the php-* containers
    | via compose `env_file`, and reading env() from config is fine as long as
    | the config cache is not built in dev — do not run `config:cache` locally).
    |
    */

    'messaging' => [

        'rabbitmq' => [
            'host' => env('RABBITMQ_HOST', 'rabbitmq'),
            'port' => (int) env('RABBITMQ_PORT', 5672),
            'user' => env('RABBITMQ_USER', 'opspilot'),
            'password' => env('RABBITMQ_PASSWORD', 'opspilot'),
            'vhost' => env('RABBITMQ_VHOST', '/'),
        ],

        // Primary topic exchange every OpsPilot event flows through.
        'exchange' => env('OPSPILOT_EXCHANGE', 'opspilot.events'),

        // Work queue the agent consumes, plus its inbound routing key.
        'analysis_queue' => env('OPSPILOT_ANALYSIS_QUEUE', 'agent.analysis.requested'),
        'analysis_routing_key' => env('OPSPILOT_ANALYSIS_ROUTING_KEY', 'agent.analysis.requested'),

        // Dead-letter exchange + queue for rejected messages.
        'dlx' => env('OPSPILOT_DLX', 'opspilot.dlx'),
        'dlq' => env('OPSPILOT_DLQ', 'agent.analysis.requested.dlq'),

        // Routing key the agent publishes AnalysisResult back on.
        'analysis_completed_routing_key' => env('OPSPILOT_ANALYSIS_COMPLETED_ROUTING_KEY', 'agent.analysis.completed'),
    ],

];
