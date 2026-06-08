"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import cn from "classnames";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import { FeatherClock, FeatherEdit2, FeatherLink, FeatherList } from "@subframe/core";
import { Badge } from "@/ui/components/Badge";
import { Breadcrumbs } from "@/ui/components/Breadcrumbs";
import { Button } from "@/ui/components/Button";
import { APP_SCROLL_CONTAINER_SELECTOR } from "@/src/utils/scroll-main";
import { estimateReadingTimeMinutes } from "@/src/lib/wiki/markdown";
import type { WikiDocument } from "@/src/lib/wiki/types/records";

interface WikiDocumentViewProps {
  document: WikiDocument;
  canManage: boolean;
}

interface TocItem {
  id: string;
  text: string;
  level: number;
}

const PROSE_CLASS = cn(
  "wiki-article prose max-w-none text-default-font",
  "prose-headings:text-default-font",
  "prose-p:text-default-font prose-li:text-default-font",
  "prose-strong:text-default-font prose-code:text-default-font",
  "prose-a:text-brand-700",
  "prose-blockquote:border-l-brand-600 prose-blockquote:text-subtext-color",
  "prose-pre:bg-neutral-900 prose-pre:text-white",
);

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function Separator() {
  return (
    <span className="text-caption font-caption text-subtext-color">·</span>
  );
}

export function WikiDocumentView({
  document: doc,
  canManage,
}: WikiDocumentViewProps) {
  const router = useRouter();
  const contentRef = useRef<HTMLDivElement>(null);
  const [toc, setToc] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const readingTime = useMemo(
    () => estimateReadingTimeMinutes(doc.content),
    [doc.content],
  );
  const hasContent = doc.content.trim().length > 0;

  const scrollToId = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, []);

  // Build the ToC from the rendered DOM so its anchors are guaranteed to match
  // the ids rehype-slug assigned to the headings.
  useEffect(() => {
    const container = contentRef.current;
    if (!container) {
      setToc([]);
      return;
    }
    const items = Array.from(
      container.querySelectorAll<HTMLElement>("h2[id], h3[id]"),
    ).map((node) => ({
      id: node.id,
      text: node.textContent?.trim() ?? "",
      level: node.tagName === "H2" ? 2 : 3,
    }));
    setToc(items);
  }, [doc.content]);

  // Highlight the section currently in view. Observes within the app's scroll
  // container (the page does not scroll on `window`).
  useEffect(() => {
    if (toc.length === 0) return;
    const root = document.querySelector<HTMLElement>(
      APP_SCROLL_CONTAINER_SELECTOR,
    );

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting);
        if (visible.length === 0) return;
        const topMost = visible.reduce((closest, entry) =>
          entry.boundingClientRect.top < closest.boundingClientRect.top
            ? entry
            : closest,
        );
        setActiveId(topMost.target.id);
      },
      { root: root ?? null, rootMargin: "0px 0px -70% 0px", threshold: 0 },
    );

    toc.forEach((item) => {
      const element = document.getElementById(item.id);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, [toc]);

  const components: Components = useMemo(() => {
    const makeHeading = (Tag: "h1" | "h2" | "h3") =>
      function HeadingRenderer({
        id,
        children,
      }: {
        id?: string;
        children?: React.ReactNode;
      }) {
        return (
          <Tag id={id} className="group/heading relative">
            {children}
            {id ? (
              <a
                href={`#${id}`}
                aria-label="Link to this section"
                onClick={(event) => {
                  event.preventDefault();
                  scrollToId(id);
                }}
                className="ml-2 inline-flex no-underline align-middle text-neutral-400 opacity-0 transition-opacity hover:text-brand-700 group-hover/heading:opacity-100"
              >
                <FeatherLink className="h-4 w-4" />
              </a>
            ) : null}
          </Tag>
        );
      };

    return {
      h1: makeHeading("h1"),
      h2: makeHeading("h2"),
      h3: makeHeading("h3"),
      a: function AnchorRenderer({
        href,
        children,
      }: {
        href?: string;
        children?: React.ReactNode;
      }) {
        const isExternal = Boolean(href && /^https?:\/\//.test(href));
        return (
          <a
            href={href}
            target={isExternal ? "_blank" : undefined}
            rel={isExternal ? "noopener noreferrer" : undefined}
          >
            {children}
          </a>
        );
      },
    };
  }, [scrollToId]);

  return (
    <div className="flex w-full flex-col items-start gap-6">
      <div className="flex w-full flex-wrap items-center justify-between gap-3">
        <Breadcrumbs>
          <Breadcrumbs.Item onClick={() => router.push("/wiki")}>
            Wiki
          </Breadcrumbs.Item>
          {doc.category_name && doc.category_slug ? (
            <>
              <Breadcrumbs.Divider />
              <Breadcrumbs.Item
                onClick={() =>
                  router.push(`/wiki?category=${doc.category_slug}`)
                }
              >
                {doc.category_name}
              </Breadcrumbs.Item>
            </>
          ) : null}
          <Breadcrumbs.Divider />
          <Breadcrumbs.Item active={true}>{doc.title}</Breadcrumbs.Item>
        </Breadcrumbs>

        {canManage ? (
          <Button
            variant="neutral-secondary"
            icon={<FeatherEdit2 />}
            onClick={() => router.push(`/wiki/edit/${doc.id}`)}
          >
            Edit
          </Button>
        ) : null}
      </div>

      <div className="flex w-full flex-col items-start gap-3">
        {doc.category_name || (canManage && doc.status === "draft") ? (
          <div className="flex flex-wrap items-center gap-2">
            {doc.category_name ? (
              <Badge variant={doc.category_color ?? "neutral"}>
                {doc.category_name}
              </Badge>
            ) : null}
            {canManage && doc.status === "draft" ? (
              <Badge variant="neutral">Draft</Badge>
            ) : null}
          </div>
        ) : null}

        <span className="text-heading-1 font-heading-1 text-default-font">
          {doc.title}
        </span>

        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1 text-caption font-caption text-subtext-color">
            <FeatherClock className="h-3 w-3" />
            {readingTime} min read
          </span>
          <Separator />
          <span className="text-caption font-caption text-subtext-color">
            Updated {formatDate(doc.updated_at)}
          </span>
        </div>
      </div>

      <div className="flex h-px w-full flex-none bg-neutral-border" />

      <div className="flex w-full items-start gap-10 mobile:flex-col mobile:gap-6">
        <div
          ref={contentRef}
          className={cn(PROSE_CLASS, "grow shrink-0 basis-0 w-full max-w-3xl")}
        >
          {hasContent ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeSlug]}
              components={components}
            >
              {doc.content}
            </ReactMarkdown>
          ) : (
            <p className="text-body font-body text-subtext-color">
              This document is empty.
            </p>
          )}
        </div>

        {toc.length > 0 ? (
          <nav className="sticky top-0 flex w-56 flex-none flex-col gap-2 mobile:hidden">
            <span className="inline-flex items-center gap-1 text-caption-bold font-caption-bold text-default-font">
              <FeatherList className="h-3 w-3" />
              On this page
            </span>
            {toc.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => scrollToId(item.id)}
                className={cn(
                  "text-left text-caption font-caption text-subtext-color transition-colors hover:text-default-font",
                  { "pl-3": item.level === 3 },
                  {
                    "text-brand-700 font-caption-bold": activeId === item.id,
                  },
                )}
              >
                {item.text}
              </button>
            ))}
          </nav>
        ) : null}
      </div>
    </div>
  );
}
