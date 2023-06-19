<?php

namespace Mouna\Bundle\formIOBundle\DependencyInjection;

use Ibexa\Bundle\Core\DependencyInjection\Configuration\SiteAccessAware\Configuration as SiteAccessConfiguration;
use Symfony\Component\Config\Definition\Builder\TreeBuilder;
use Symfony\Component\HttpKernel\Kernel;

class Configuration extends SiteAccessConfiguration
{
    public const CONFIGRESOLVER_NAMESPACE = 'form_io';
    public function getConfigTreeBuilder(): TreeBuilder
    {
        if (Kernel::MAJOR_VERSION > 4) {
            $treeBuilder = new TreeBuilder(self::CONFIGRESOLVER_NAMESPACE);
            $rootNode = $treeBuilder->getRootNode();
        } else {
            $treeBuilder = new TreeBuilder();
            $rootNode = $treeBuilder->root(self::CONFIGRESOLVER_NAMESPACE);
        }
        $this->generateScopeBaseNode($rootNode)
                ->scalarNode('fieldtype_formiourl_identifier')->defaultValue('form_io_url')->end()
                ->scalarNode('admin_user_id')->end()
                ->scalarNode('formiourl_field_name')->end()
                ->scalarNode('formiourl_field_description')->end()
                ->arrayNode('default_metas')
                    ->children()
                        ->scalarNode('author')->end()
                        ->scalarNode('copyright')->end()
                        ->scalarNode('generator')->end()
                        ->scalarNode('MSSmartTagsPreventParsing')->end()
                    ->end()
                ->end()
                ->scalarNode('dqe_host')
                    ->info('DQE host used by the DQE proxy')
                ->end()
                ->arrayNode('dqe_validator')
                    ->info('DQE siteaccess configuration')
                    ->children()
                        ->booleanNode('enabled')
                            ->info('Enable the DQE validation and proxy')
                        ->end()
                        ->booleanNode('validate_referer')
                            ->info('Validates proxy access trough the HTTP_REFERER header')
                        ->end()
                        ->scalarNode('key')
                            ->info('DQE licence key')
                        ->end()
                    ->end()
                ->end();

        return $treeBuilder;
    }
}
