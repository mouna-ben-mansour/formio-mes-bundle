# FORM IO Bundle

----

## On this page
- [Install](#install)
- [configuration](#configuration)
- [How to work with the bundle](#how-to-work-with-the-bundle)



----

## Install


### Use Composer

Add the lib to your composer.json, run `composer require novactive/formiobundle` to refresh dependencies.

Then inject the bundle in the `bundles.php` of your application.

```php
    Novactive\Bundle\formIOBundle\FormIOBundle::class => [ 'all'=> true ],
```

### Add routes

Make sure you add this route to your routing:

```yml
# config/routes.yaml

formio_dqe_proxy:
  resource: "@FormIOBundle/Resources/config/routing/routing_dqe.yaml"
  prefix:   /formio_dqe

```

### Override if needed admin config parameter 

It is used in command Add field form-io-url in Content Type

```yml
formio.default.admin_user_id: NEW_ADMIN_ID
```

## Configuration

### DQE Validation

A javascript module is provided to plug the DQE validation into your form. **DQE validation requires jQuery UI 1.13.**

#### Configure DQE

```yaml
formio:
  system:
    default:
      # DQE host called by the proxy
      dqe_host: '[Host used by the DQE proxy]' # Default: https://prod2.dqe-software.com
      dqe_validator:
        # Is the DQE proxy enabled for your site
        enabled: true
        # Should the proxy check if the referer matches the proxy scheme and host
        validate_referer: true 
        # DQE licence key
        key:  '%env(DQE_LICENCE)%'
```

#### Add DQE LICENSE to `.env

Notice the `'%env(var)%'`call? Add these anywhere in your `.env` .
```bash
# .env
# ...

DQE_LICENCE==''
```

## How to work with the bundle

### Add the Field `form-io-url` to your Content Type

A command is provided to simply add the Field.

```bash
$ php bin/console formio:form-io-url -h
Usage:
 formio:form-io-url[--identifier="..."] [--identifiers="..."] [--group_identifier="..."]

Options:
 --identifier          a content type identifier
 --identifiers         some content types identifier, separated by a comma
 --group_identifier    a content type group identifier

Help:
 The command formio:form-io-url add the Field 'form-io-url'.
 You can select the Content Type via the identifier, identifiers, group_identifier option.
     - Identifier will be: %formio.default.fieldtype_formiourl_identifier%
```

