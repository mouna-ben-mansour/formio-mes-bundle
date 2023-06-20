<?php

namespace Novactiva\Bundle\formIOBundle\Controller;

use Novactiva\Bundle\formIOBundle\DependencyInjection\Configuration;
use Novactiva\Bundle\formIOBundle\Dqe\DqeProxy;
use Ibexa\Contracts\Core\SiteAccess\ConfigResolverInterface;
use Ibexa\Core\MVC\Symfony\SiteAccess;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;

class DqeController extends AbstractController
{
    public function __construct(
        private ConfigResolverInterface $configResolver,
        private DqeProxy $dqeProxy,
        private SiteAccess $siteAccess
    ) {
    }

    public function proxy(Request $request): Response
    {
        $dqeValidatorConfig = $this->configResolver
            ->getParameter('dqe_validator', Configuration::CONFIGRESOLVER_NAMESPACE);
        $dqeHost = $this->configResolver
            ->getParameter('dqe_host', Configuration::CONFIGRESOLVER_NAMESPACE);
        if ($dqeValidatorConfig['enabled'] === false ||
            ($dqeValidatorConfig['enabled'] === true &&
                $dqeValidatorConfig['validate_referer'] === true &&
                !str_contains($request->headers->get('referer'), $request->getSchemeAndHttpHost()))) {
            throw new AccessDeniedHttpException();
        }

        if (!$request->request->has('url')) {
            throw new BadRequestHttpException();
        }

        $this->dqeProxy->setLogPrefix('[' . $this->siteAccess->name . ']');
        $this->dqeProxy->instantiateClient($dqeHost, $dqeValidatorConfig['key']);

        $url = $request->request->get('url');
        parse_str(parse_url($url, PHP_URL_QUERY), $params);
        if (isset($params['Adresse'])) {
            $adress = $params['Adresse'];
            $adressWithoutAccents = \Transliterator::create('NFD; [:Nonspacing Mark:] Remove; NFC')
                ->transliterate($adress);
            $adressWithoutAccents = preg_replace('/[^a-zA-Z0-9]/', ' ', $adressWithoutAccents);
            $url = str_replace(rawurlencode($adress), rawurlencode($adressWithoutAccents), $url);
        }
        $response = $this->dqeProxy->proxy($url);

        return new Response($response->getBody()->getContents(), $response->getStatusCode(), [
            'Content-Type' => 'application/json',
        ]);
    }
}
