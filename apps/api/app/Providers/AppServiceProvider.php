<?php

namespace App\Providers;

use App\Messaging\AnalysisRequestPublisher;
use App\Messaging\RabbitMqConnection;
use Illuminate\Contracts\Foundation\Application;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->singleton(RabbitMqConnection::class, function (Application $app): RabbitMqConnection {
            /** @var array<string, mixed> $config */
            $config = $app->make('config')->get('opspilot.messaging');

            return new RabbitMqConnection($config);
        });

        $this->app->singleton(AnalysisRequestPublisher::class, function (Application $app): AnalysisRequestPublisher {
            /** @var array<string, mixed> $config */
            $config = $app->make('config')->get('opspilot.messaging');

            return new AnalysisRequestPublisher($app->make(RabbitMqConnection::class), $config);
        });
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        //
    }
}
