<?php

namespace Novactive\Bundle\formIOBundle\DependencyInjection;

use Ibexa\Bundle\Core\DependencyInjection\Configuration\SiteAccessAware\ConfigurationProcessor;
use Ibexa\Bundle\Core\DependencyInjection\Configuration\SiteAccessAware\ContextualizerInterface;
use Symfony\Component\Config\FileLocator;
use Symfony\Component\Config\Resource\FileResource;
use Symfony\Component\DependencyInjection\ContainerBuilder;
use Symfony\Component\DependencyInjection\Extension\PrependExtensionInterface;
use Symfony\Component\DependencyInjection\Loader;
use Symfony\Component\HttpKernel\DependencyInjection\Extension;
use Symfony\Component\Yaml\Yaml;


class FormIOExtension extends Extension implements PrependExtensionInterface
{
    public function load(array $configs, ContainerBuilder $container): void
    {
        $configuration = new Configuration();
        $config = $this->processConfiguration($configuration, $configs);

        $processor = new ConfigurationProcessor($container, Configuration::CONFIGRESOLVER_NAMESPACE);
        $parameters = [
            'formiourl_field_name',
            'formiourl_field_description',
            'admin_user_id',
            'fieldtype_formiourl_identifier',
            'dqe_host'
        ];
        foreach ($parameters as $parameter) {
            $processor->mapSetting($parameter, $config);
        }

        $processor->mapConfigArray('dqe_validator', $config, ContextualizerInterface::MERGE_FROM_SECOND_LEVEL);
        $processor->mapConfigArray('default_metas', $config, ContextualizerInterface::MERGE_FROM_SECOND_LEVEL);
        $loader = new Loader\YamlFileLoader($container, new FileLocator(__DIR__ . '/../Resources/config'));
        $loader->load('services.yaml');

        if ($container->hasParameter(' formio.default.admin_user_id')) {
            $container->setParameter(
                'formio.default.default.admin_user_id',
                $container->getParameter('formio.default.admin_user_id')
            );
        }
    }

    public function prepend(ContainerBuilder $container): void
    {
        $configPath = __DIR__.'/../Resources/config';
        $loader     = new Loader\YamlFileLoader($container, new FileLocator($configPath));
        $loader->load('default_settings.yaml');
            $configFile = $configPath.'/views.yaml';
            $config     = Yaml::parse(file_get_contents($configFile));
            $container->prependExtensionConfig('ibexa', $config);
            $container->addResource(new FileResource($configFile));
    }
}
