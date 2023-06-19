# FORM IO Bundle

----

## On this page
- [Install](#install)
- [configuration](#configuration)
- [Examples](#examples)
- [How to work on the bundle](#how-to-work-on-the-bundle)
- [Requirements](#requirements)


----

## Install

## <i class="fa fa-spinner"></i> Installation steps

### Use Composer

Add the lib to your composer.json, run `composer require novactive/formiobundle` to refresh dependencies.

Then inject the bundle in the `bundles.php` of your application.

```php
    Novactive\Bundle\formIOBundle\formIOBundle::class => [ 'all'=> true ],
```

### Add routes

Make sure you add this route to your routing:

```yml
# config/routes.yaml

formio_dqe_proxy:
  resource: "@formIOBundle/Resources/config/routing/routing_dqe.yaml"
  prefix:   /formio_dqe

```

### Override if needed admin config parameter 

It is used in command Add field SEO in Content Type

```yml
form_io.default.admin_user_id: NEW_ADMIN_ID
```

## Configuration


## Examples


## How to work on the bundle


## Requirements
