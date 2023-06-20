<?php

namespace Novactive\Bundle\formIOBundle;

use Novactive\Bundle\formIOBundle\DependencyInjection\FormIOExtension;
use LogicException;
use Novactive\Bundle\formIOBundle\DependencyInjection\Compiler\CustomFallbackPass;
use Novactive\Bundle\formIOBundle\DependencyInjection\Security\PolicyProvider\PolicyProvider;
use Symfony\Component\DependencyInjection\ContainerBuilder;
use Symfony\Component\DependencyInjection\Extension\ExtensionInterface;
use Symfony\Component\HttpKernel\Bundle\Bundle;

class FormIOBundle extends Bundle
{
    public function getContainerExtension(): ?ExtensionInterface
    {
        if (null === $this->extension) {
            $extension = $this->createContainerExtension();
            if (null !== $extension) {
                if (!$extension instanceof ExtensionInterface) {
                    $fqdn = \get_class($extension);
                    $message = 'Extension %s must implement %s.';
                    throw new LogicException(sprintf($message, $fqdn, ExtensionInterface::class));
                }
                $this->extension = $extension;
            } else {
                $this->extension = false;
            }
        }

        return $this->extension ?: null;

    }
}
