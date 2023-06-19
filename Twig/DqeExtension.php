<?php

namespace Mouna\formIOBundle\Twig;

use Symfony\Component\Form\FormView;
use Symfony\Component\Routing\Generator\UrlGeneratorInterface;
use Symfony\Component\Routing\RouterInterface;
use Twig\Extension\AbstractExtension;
use Twig\TwigFunction;

class DqeExtension extends AbstractExtension
{

    public function __construct(
        private RouterInterface $router
    ) {
    }

    public function getFunctions(): array
    {
        return [
            new TwigFunction('dqe_parameters', [$this, 'dqeParameters']),
        ];
    }

    /**
     * Returns the parameters used to instanciate the DqeValidator JS module as a JSON string
     * To override the default messages, pass an associative array to $parameters with following keys :
     *  - msgRequired => Local required fields validation failure
     *  - msgRadioRequired  => Local required radio fields validation failure
     *  - msgPhoneInvalid => DQE phone validation failure
     *  - msgEmailRectified => DQE rectified e-mail message (msgEmailRectified + ' ' + rectifiedEmail ).
     */
    public function dqeParameters(
        FormView $form,
        FormView $email,
        FormView $phoneOrCellNumber,
        FormView $cityOrZipCode,
        array $parameters = []
    ): string {
        $parameters = array_merge($parameters, [
            'route' => $this->router
                ->generate('formio_dqe_proxy', [], UrlGeneratorInterface::ABSOLUTE_URL),
            'formName' => $form->vars['name'],
            'email' => $email->vars['id'],
            'phoneOrCellNumber' => $phoneOrCellNumber->vars['id'],
            'cityOrZipCode' => $cityOrZipCode->vars['id'],
        ]);

        return json_encode($parameters);
    }
}
