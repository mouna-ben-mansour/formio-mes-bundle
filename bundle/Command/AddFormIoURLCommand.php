<?php

namespace Mouna\Bundle\formIOBundle\Command;

use Mouna\Bundle\formIOBundle\Command\ContentType;
use Mouna\Bundle\formIOBundle\Core\Converter\ContentTypesHelper;
use Mouna\Bundle\formIOBundle\Core\Installer\Field as FieldInstaller;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Style\SymfonyStyle;
use Symfony\Component\Console\Question\ConfirmationQuestion;
use Ibexa\Contracts\Core\Repository\Repository;
use Ibexa\Contracts\Core\Repository\UserService;
use Ibexa\Contracts\Core\SiteAccess\ConfigResolverInterface;

class AddFormIoURLCommand extends Command
{
    /**
     * @var ConfigResolverInterface
     */
    private $configResolver;
    /**
     * @var FieldInstaller
     */
    private $fieldInstaller;
    /**
     * @var ContentTypesHelper
     */
    private $contentTypesHelper;

    /**
     * @var Repository
     */
    private $repository;

    /**
     * @var UserService
     */
    private $userService;

    public function __construct(
        ConfigResolverInterface $configResolver,
        ContentTypesHelper $contentTypesHelper,
        FieldInstaller $fieldInstaller,
        Repository $repository,
        UserService $userService
    ) {
        $this->configResolver = $configResolver;
        $this->contentTypesHelper = $contentTypesHelper;
        $this->fieldInstaller = $fieldInstaller;
        $this->repository = $repository;
        $this->userService = $userService;
        parent::__construct();
    }
    // In this function set the name, description and help hint for the command
    protected function configure(): void
    {
        // Use in-build functions to set name, description and help

        $this->setName('formio:form-io-url')
            ->setDescription('Add form-io-url to Content Types')
            ->addOption('identifier', null, InputOption::VALUE_REQUIRED, 'a content type identifier')
            ->addOption(
                'identifiers',
                null,
                InputOption::VALUE_REQUIRED,
                'some content types identifier, separated by a comma'
            )
            ->addOption('group_identifier', null, InputOption::VALUE_REQUIRED, 'a content type group identifier')
            ->setHelp(
                <<<EOT
                    The command <info>%command.name%</info> add the FieldType 'form-io-url'.
                    You can select the Content Type via the <info>identifier</info>, <info>identifiers</info>,
                    <info>group_identifier</info> option.
                        - Identifier will be: <comment>%nova_ezseo.default.fieldtype_metas_identifier%</comment>
                        - Name will be: <comment>Metas</comment>
                        - Category will be: <comment>SEO</comment>
                    EOT
            );
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);

        $contentTypes = [];

        $groupIdentifier = $input->getOption('group_identifier');
        if (!empty($groupIdentifier)) {
            $contentTypes = $this->contentTypesHelper->getContentTypesByGroup($groupIdentifier);
        }

        $identifiers = $input->getOption('identifiers');
        if (!empty($identifiers)) {
            $contentTypes = $this->contentTypesHelper->getContentTypesByIdentifier($identifiers);
        }

        $identifier = $input->getOption('identifier');
        if (!empty($identifier)) {
            $contentTypes = $this->contentTypesHelper->getContentTypesByIdentifier($identifier);
        }

        $output->writeln('<info>Selected Content Type:</info>');
        foreach ($contentTypes as $contentType) {
            /* @var ContentType $contentType */
            $output->writeln("\t- {$contentType->getName($contentType->mainLanguageCode)}");
        }
        $helper = $this->getHelper('question');
        $question = new ConfirmationQuestion(
            "\n<question>Are you sure you want to add form-io-url all these Content Type?</question>[yes]",
            true
        );

        if (!$helper->ask($input, $output, $question)) {
            $io->success('Nothing to do.');

            return 0;
        }

        if (0 === \count($contentTypes)) {
            $io->success('Nothing to do.');

            return 0;
        }

        $fieldName = $this->configResolver->getParameter('fieldtype_formiourl_identifier', 'formio');
        foreach ($contentTypes as $contentType) {
            $io->section("Doing {$contentType->getName()}");
            if ($this->fieldInstaller->fieldExists($fieldName, $contentType)) {
                $io->block('Field exists');
                continue;
            }
            if (!$this->fieldInstaller->addToContentType($fieldName, $contentType)) {
                $io->error(
                    sprintf(
                        'There were errors when adding new field to <info>%s</info> ContentType: <error>%s</error>',
                        $contentType->getName($contentType->mainLanguageCode),
                        $this->fieldInstaller->getErrorMessage()
                    )
                );
                continue;
            }
            $io->block('FieldType added.');
        }

        $io->success('Done.');

        return 0;
    }
    protected function initialize(InputInterface $input, OutputInterface $output): void
    {
        $io = new SymfonyStyle($input, $output);
        $io->comment('Switching to Admin');

        $this->repository->getPermissionResolver()->setCurrentUserReference(
            $this->userService->loadUser(
                $this->configResolver->getParameter('admin_user_id','mouna.formiobundle')
            )
        );
    }
}