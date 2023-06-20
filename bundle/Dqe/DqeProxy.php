<?php

namespace Novactiva\formIOBundle\Dqe;

use GuzzleHttp\Client as HttpClient;
use Psr\Http\Message\ResponseInterface;
use Psr\Log\LoggerInterface;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Throwable;

class DqeProxy
{
    protected const USERAGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:57.0) Gecko/20100101 Firefox/57.0';

    protected const TIMEOUT = 15;

    /**
     * @var HttpClient
     */
    private HttpClient $client;

    /**
     * @var string
     */
    private string $key;

    /**
     * @var string
     */
    private string $host;

    /**
     * @var string
     */
    private string $logPrefix;
    private LoggerInterface $formiobundleLogger;

    public function __construct(
        LoggerInterface $formiobundleLogger
    ) {
        $this->formiobundleLogger = $formiobundleLogger;
    }

    /**
     * Create the client instance with the current siteaccess parameters.
     */
    public function instantiateClient(string $host, string $key): void
    {
        $this->key = $key;
        $this->host = preg_replace('/\/$/i', '', $host);
        $this->client = new HttpClient([
            'timeout' => 15,
            'verify' => false,
        ]);
    }

    /**
     * Set a custom log prefix for your calls.
     */
    public function setLogPrefix(string $logPrefix): void
    {
        $this->logPrefix = $logPrefix;
    }

    /**
     * @throws Throwable
     */
    public function proxy(string $url): ResponseInterface
    {
        if (strpos($url, $this->host) === false) {
            $url = preg_replace('/^(http[s]?:\/\/[^\/]+)\/(.+)$/i', $this->host . '/$2', $url);
        }
        try {
            $this->formiobundleLogger->debug($this->prefixLogMessage('Request ' . $url));
           // dd($this->host.'/'.$url . $this->key );
            return $this->getClient()->get($this->host.'/'.$url . $this->key, [
                'headers' => [
                    'User-Agent' => self::USERAGENT,
                ],
            ]);
        } catch (Throwable $throwable) {
            $this->formiobundleLogger
                ->critical($this->prefixLogMessage('Error ' . $throwable->getCode() . ' ' . $throwable->getMessage()));

            throw $throwable;
        }
    }

    /**
     * @throws HttpException
     */
    protected function getClient(): HttpClient
    {
        if ($this->client instanceof HttpClient) {
            return $this->client;
        }
        throw new HttpException(500, self::class . ' client not set. Call instantiateClient() method first');
    }

    protected function prefixLogMessage($message): string
    {
        return '[DqeProxy]' . $this->logPrefix . ' ' . $message;
    }
}
