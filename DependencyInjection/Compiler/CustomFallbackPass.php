<?php

namespace App\formIOBundle\DependencyInjection\Compiler;

use App\formIOBundle\DependencyInjection\FormIOExtension;
use Symfony\Component\DependencyInjection\Compiler\CompilerPassInterface;
use Symfony\Component\DependencyInjection\ContainerBuilder;
use Symfony\Component\DependencyInjection\Reference;

class CustomFallbackPass implements CompilerPassInterface
{
    public function process(ContainerBuilder $container): void
    {
        $configs = $container->getExtensionConfig('form_io');

        // @todo: How to do that by SiteAccess
        if (isset($configs[0]['system']['default']['custom_fallback_service'])) {
            $fallbackService = $configs[0]['system']['default']['custom_fallback_service'];
            if (null !== $fallbackService) {
                $container->getDefinition(FormIOExtension::class)->addMethodCall(
                    'setCustomFallbackService',
                    [new Reference($fallbackService)]
                );
            }
        }
    }
}
