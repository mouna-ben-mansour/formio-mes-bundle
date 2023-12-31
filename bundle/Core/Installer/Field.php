<?php

namespace Novactive\Bundle\formIOBundle\Core\Installer;

use DateTime;
use Exception;
use Ibexa\Contracts\Core\Repository\ContentTypeService;
use Ibexa\Contracts\Core\Repository\Exceptions\NotFoundException;
use Ibexa\Contracts\Core\Repository\Values\ContentType\ContentType;
use Ibexa\Contracts\Core\SiteAccess\ConfigResolverInterface;

class Field
{
    /**
     * @var ContentTypeService
     */
    private ContentTypeService $contentTypeService;

    /**
     * @var ConfigResolverInterface
     */
    private ConfigResolverInterface $configResolver;

    /**
     * @var string
     */
    private $errorMessage;

    /**
     * Constructor.
     */
    public function __construct(
        ContentTypeService $contentTypeService,
        ConfigResolverInterface $configResolver
    ) {
        $this->contentTypeService = $contentTypeService;
        $this->configResolver = $configResolver;
    }

    public function addToContentType(string $fieldName, ContentType $contentType): bool
    {
        try {
            $contentTypeDraft = $this->contentTypeService->loadContentTypeDraft($contentType->id);
        } catch (NotFoundException $e) {
            $contentTypeDraft = $this->contentTypeService->createContentTypeDraft($contentType);
        }

        $typeUpdate = $this->contentTypeService->newContentTypeUpdateStruct();
        $typeUpdate->modificationDate = new DateTime();

        $knowLanguage = array_keys($contentType->getDescriptions());

        if (!\in_array($contentType->mainLanguageCode, $knowLanguage)) {
            $knowLanguage[] = $contentType->mainLanguageCode;
        }

        $fieldCreateStruct = $this->contentTypeService->newFieldDefinitionCreateStruct(
            $fieldName,
            'ezurl'
        );

        $fieldCreateStruct->names =
            array_fill_keys(
                $knowLanguage,
                $this->configResolver->getParameter('formiourl_field_name', 'formio')
            );
        $fieldCreateStruct->descriptions =
            array_fill_keys(
                $knowLanguage,
                $this->configResolver->getParameter('formiourl_field_description', 'formio')
            );

        $fieldCreateStruct->position = 100;
        $fieldCreateStruct->isTranslatable = true;
        $fieldCreateStruct->isRequired = false;
        $fieldCreateStruct->isSearchable = false;
        $fieldCreateStruct->isInfoCollector = false;

        try {
            $this->contentTypeService->updateContentTypeDraft($contentTypeDraft, $typeUpdate);

            if (null == $contentTypeDraft->getFieldDefinition($fieldName)) {
                $this->contentTypeService->addFieldDefinition($contentTypeDraft, $fieldCreateStruct);
            }

            $this->contentTypeService->publishContentTypeDraft($contentTypeDraft);

            return true;
        } catch (Exception $e) {
            $this->errorMessage = $e->getMessage();

            return false;
        }
    }

    public function fieldExists(string $fieldName, ContentType $contentType): bool
    {
        $fieldDefinition = $contentType->getFieldDefinition($fieldName);

        return null !== $fieldDefinition;
    }

    public function getErrorMessage(): string
    {
        return $this->errorMessage;
    }
}
