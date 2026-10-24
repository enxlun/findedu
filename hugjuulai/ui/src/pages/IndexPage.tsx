import { useQuery } from "@apollo/client";
import type { ComponentType, ReactNode } from "react";
import {
  IconBook,
  IconDatabase,
  IconExternalLink,
  IconLayoutDashboard,
  IconSandbox,
  IconSettings,
} from "@tabler/icons-react";
// Root imports on purpose: core-ui shares `erxes-ui`/`ui-modules` as Module
// Federation singletons keyed on the bare specifier, so deep imports would
// bundle second private copies instead of reusing the host's.
import {
  Badge,
  Breadcrumb,
  Button,
  Card,
  Separator,
  Skeleton,
  cn,
} from "erxes-ui";
import { PageHeader } from "ui-modules";
import { Link } from "react-router";
import manifest from "../../../erxes.json" with { type: "json" };
import { STATUS_QUERY } from "../graphql";
import { Samples } from "../Samples";

const { path } = manifest.ui;

const Dot = ({ className }: { className?: string }) => (
  <span
    className={cn(
      "hugjuulai:inline-block hugjuulai:size-2 hugjuulai:rounded-full",
      className,
    )}
  />
);

const StatusRow = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="hugjuulai:flex hugjuulai:items-center hugjuulai:justify-between hugjuulai:gap-4 hugjuulai:text-sm">
    <span className="hugjuulai:text-muted-foreground">{label}</span>
    <span className="hugjuulai:flex hugjuulai:items-center hugjuulai:gap-2 hugjuulai:font-medium">
      {children}
    </span>
  </div>
);

const ConnectionCard = () => {
  const { data, loading, error, refetch } = useQuery(STATUS_QUERY);
  const status = data?.hugjuulaiStatus;

  const pending = (
    <>
      <Dot className="hugjuulai:animate-pulse hugjuulai:bg-muted-foreground" />
      <Skeleton className="hugjuulai:h-4 hugjuulai:w-24" />
    </>
  );

  return (
    <Card className="hugjuulai:w-full hugjuulai:md:w-80 hugjuulai:shrink-0">
      <Card.Header>
        <Card.Title className="hugjuulai:text-sm">Connection</Card.Title>
        <Card.Description>
          Live status of this plugin inside erxes
        </Card.Description>
      </Card.Header>
      <Card.Content className="hugjuulai:flex hugjuulai:flex-col hugjuulai:gap-3">
        <StatusRow label="API">
          {loading ? (
            pending
          ) : error ? (
            <>
              <Dot className="hugjuulai:bg-destructive" />
              <span>Unreachable</span>
              <Button variant="ghost" size="sm" onClick={() => refetch()}>
                Retry
              </Button>
            </>
          ) : (
            <>
              <Dot className="hugjuulai:bg-success" />
              <span>Connected · v{status?.version}</span>
            </>
          )}
        </StatusRow>
        <StatusRow label="Gateway">
          {loading ? (
            pending
          ) : error ? (
            <>
              <Dot className="hugjuulai:bg-destructive" />
              <span
                className="hugjuulai:truncate hugjuulai:max-w-40"
                title={error.message}
              >
                {error.message}
              </span>
            </>
          ) : (
            <>
              <Dot className="hugjuulai:bg-success" />
              <span>Federated as {status?.plugin}</span>
            </>
          )}
        </StatusRow>
        <StatusRow label="Tenant">
          {loading ? pending : (status?.subdomain ?? "—")}
        </StatusRow>
        <StatusRow label="Signed in">
          {loading
            ? pending
            : (status && (status.userEmail ?? status.userId ?? "Anonymous")) ||
              "—"}
        </StatusRow>
      </Card.Content>
    </Card>
  );
};

const StepCard = ({
  icon: Icon,
  title,
  description,
  code,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  code: string;
}) => (
  <Card>
    <Card.Header>
      <div className="hugjuulai:flex hugjuulai:size-9 hugjuulai:items-center hugjuulai:justify-center hugjuulai:rounded-lg hugjuulai:bg-accent">
        <Icon className="hugjuulai:size-5" />
      </div>
      <Card.Title>{title}</Card.Title>
      <Card.Description>{description}</Card.Description>
    </Card.Header>
    <Card.Content>
      <code className="hugjuulai:rounded hugjuulai:bg-muted hugjuulai:px-1.5 hugjuulai:py-0.5 hugjuulai:font-mono hugjuulai:text-xs">
        {code}
      </code>
    </Card.Content>
  </Card>
);

const STEPS = [
  {
    icon: IconDatabase,
    title: "Model your data",
    description:
      "Define the records this plugin owns and expose them on the federated graph.",
    code: "api/src/modules/sample",
  },
  {
    icon: IconLayoutDashboard,
    title: "Build the page",
    description:
      "Replace this overview with your module: lists with RecordTable, forms with Form, details in a Sheet.",
    code: "ui/src/pages/IndexPage.tsx",
  },
];

export const IndexPage = () => (
  <div className="hugjuulai:flex hugjuulai:h-full hugjuulai:flex-col">
    <PageHeader>
      <PageHeader.Start>
        <Breadcrumb>
          <Breadcrumb.List className="hugjuulai:gap-1">
            <Breadcrumb.Item>
              <Button variant="ghost" asChild>
                <Link to={`/${path}`}>
                  <IconSandbox />
                  {manifest.title}
                </Link>
              </Button>
            </Breadcrumb.Item>
          </Breadcrumb.List>
        </Breadcrumb>
        <Separator.Inline />
        <PageHeader.FavoriteToggleButton
          breadcrumb={[manifest.title]}
          icon="IconSandbox"
        />
      </PageHeader.Start>
      <PageHeader.End>
        <Button variant="outline" asChild>
          <Link to={`/${path}/settings`}>
            <IconSettings />
            Settings
          </Link>
        </Button>
      </PageHeader.End>
    </PageHeader>
    <div className="hugjuulai:flex-1 hugjuulai:overflow-auto">
      <div className="hugjuulai:mx-auto hugjuulai:flex hugjuulai:w-full hugjuulai:max-w-5xl hugjuulai:flex-col hugjuulai:gap-6 hugjuulai:p-6">
        <section className="hugjuulai:relative hugjuulai:overflow-hidden hugjuulai:rounded-xl hugjuulai:border hugjuulai:border-border hugjuulai:bg-background hugjuulai:p-8 hugjuulai:shadow-xs">
          <div
            aria-hidden
            className="hugjuulai:pointer-events-none hugjuulai:absolute hugjuulai:inset-0 hugjuulai:bg-gradient-to-br hugjuulai:from-primary/10 hugjuulai:via-transparent hugjuulai:to-transparent"
          />
          <div className="hugjuulai:relative hugjuulai:flex hugjuulai:flex-col hugjuulai:gap-6 hugjuulai:md:flex-row hugjuulai:md:items-start hugjuulai:md:justify-between">
            <div className="hugjuulai:flex hugjuulai:max-w-xl hugjuulai:flex-col hugjuulai:gap-4">
              <div>
                <Badge variant="info">Plugin · v{manifest.version}</Badge>
              </div>
              <h1 className="hugjuulai:text-2xl hugjuulai:font-semibold hugjuulai:tracking-tight">
                Welcome to {manifest.title}
              </h1>
              <p className="hugjuulai:text-sm hugjuulai:leading-relaxed hugjuulai:text-muted-foreground">
                {manifest.description}
              </p>
              <div className="hugjuulai:flex hugjuulai:flex-wrap hugjuulai:gap-2">
                <Button asChild>
                  <Link to={`/${path}/settings`}>
                    <IconSettings />
                    Open settings
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <a
                    href="https://erxes.io/docs/create-plugin-standalone"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <IconBook />
                    Developer guide
                    <IconExternalLink />
                  </a>
                </Button>
              </div>
            </div>
            <ConnectionCard />
          </div>
        </section>
        <Samples />
        <div className="hugjuulai:grid hugjuulai:gap-4 hugjuulai:md:grid-cols-2">
          {STEPS.map((step) => (
            <StepCard key={step.title} {...step} />
          ))}
        </div>
      </div>
    </div>
  </div>
);
