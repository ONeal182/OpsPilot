<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;
use Throwable;

class HealthController extends Controller
{
    /**
     * Liveness/readiness probe for the OpsPilot API.
     *
     * Returns HTTP 200 when both the database and Redis checks pass,
     * and HTTP 503 when either one fails.
     */
    public function __invoke(): JsonResponse
    {
        $database = $this->checkDatabase();
        $redis = $this->checkRedis();

        $ok = $database === 'ok' && $redis === 'ok';

        return response()->json([
            'status' => $ok ? 'ok' : 'error',
            'service' => 'opspilot-api',
            'time' => now()->toIso8601String(),
            'checks' => [
                'database' => $database,
                'redis' => $redis,
            ],
        ], $ok ? 200 : 503);
    }

    private function checkDatabase(): string
    {
        try {
            DB::connection()->getPdo();

            return 'ok';
        } catch (Throwable) {
            return 'error';
        }
    }

    private function checkRedis(): string
    {
        try {
            Redis::connection()->ping();

            return 'ok';
        } catch (Throwable) {
            return 'error';
        }
    }
}
