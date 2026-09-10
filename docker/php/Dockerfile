FROM php:8.4-fpm

ARG WWWUSER=1000
ARG WWWGROUP=1000

# OS dependencies (kept lean; apt lists cleaned in the same layer).
RUN apt-get update && apt-get install -y --no-install-recommends \
        git \
        unzip \
        libzip-dev \
        libicu-dev \
        libpng-dev \
        libonig-dev \
        librabbitmq-dev \
        default-mysql-client \
    && docker-php-ext-configure gd \
    && docker-php-ext-install -j"$(nproc)" \
        pdo_mysql \
        mbstring \
        bcmath \
        gd \
        zip \
        intl \
        pcntl \
        sockets \
        opcache \
    && pecl install redis \
    && docker-php-ext-enable redis \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Composer from the official image.
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# PHP overrides (memory_limit for PHPStan/Composer). Applies to fpm + cli.
COPY docker/php/conf.d/zz-opspilot.ini /usr/local/etc/php/conf.d/zz-opspilot.ini

# Non-root user/group matching the host uid/gid so bind-mounted files stay writable.
RUN groupadd -g "$WWWGROUP" www \
    && useradd -u "$WWWUSER" -g www -m www

WORKDIR /var/www/html

USER www
