<?php

test('the health endpoint reports the service is up', function () {
    $response = $this->getJson('/api/health');

    $response
        ->assertOk()
        ->assertJsonPath('status', 'ok')
        ->assertJsonPath('service', 'opspilot-api')
        ->assertJsonPath('checks.database', 'ok')
        ->assertJsonStructure([
            'status',
            'service',
            'time',
            'checks' => ['database', 'redis'],
        ]);
});
