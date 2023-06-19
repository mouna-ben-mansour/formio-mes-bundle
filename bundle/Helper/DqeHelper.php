<?php

namespace Novactive\Bundle\formIOBundle\Helper;

use Psr\Log\LoggerInterface;

/**
 * Helper for Dqe.
 */
class DqeHelper
{
    public function __construct(
        protected LoggerInterface $logger,
        protected string $dqeLicense,
        protected array $dqeHosts
    ) {
    }

    public function getData($url, $timeout = 15): string|bool
    {
        $url .= $this->dqeLicense;
        $validHost = false;
        foreach ($this->dqeHosts as $host) {
            if (str_starts_with($url, $host)) {
                $validHost = true;
            }
        }
        if ($validHost) {
            try {
                $sslVerification = 0;
                if($_SERVER['REQUEST_SCHEME'] === "https"){
                    $sslVerification = 1;
                }
                $session = curl_init($url);
                curl_setopt($session, CURLOPT_TIMEOUT, $timeout);
                curl_setopt($session, CURLOPT_HEADER, false);
                curl_setopt($session, CURLOPT_RETURNTRANSFER, true);
                curl_setopt($session, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:57.0) Gecko/20100101 Firefox/57.0');
                curl_setopt($session, CURLOPT_SSL_VERIFYHOST, $sslVerification);
                curl_setopt($session, CURLOPT_SSL_VERIFYPEER, $sslVerification);

                $response = curl_exec($session);
                $httpcode = curl_getinfo($session, CURLINFO_HTTP_CODE);

                if ($httpcode !== 200) {
                    $this->logger->error(sprintf('The url %s is not found', $url));
                    return false;
                }

                if (!$response) {
                    $message = curl_error($session);
                    $this->logger->error($message);

                    return false;
                }
                curl_close($session);

                return $response;
            } catch (\Throwable $e) {
                $this->logger->error($e->getMessage());
            }
        }

        return false;
    }

}
