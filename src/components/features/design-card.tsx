"use client";

import Link from "next/link";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HtmlPreview } from "@/components/features/html-preview";
import { cn } from "@/lib/utils";

interface DesignCardProps {
  id?: string;
  name: string;
  thumbnail?: string | null;
  previewHtml?: string | null;
  updatedAt?: string;
  className?: string;
}

/* Deterministic gradient from name */
const GRADIENTS = [
  "from-amber-200/60 to-orange-300/60",
  "from-rose-200/60 to-pink-300/60",
  "from-violet-200/60 to-purple-300/60",
  "from-sky-200/60 to-blue-300/60",
  "from-emerald-200/60 to-teal-300/60",
  "from-fuchsia-200/60 to-pink-300/60",
];

function gradientFor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}

export function DesignCard({
  id,
  name,
  thumbnail,
  previewHtml,
  updatedAt,
  className,
}: DesignCardProps) {
  const content = (
    <Card
      className={cn(
        "group flex h-full flex-col overflow-hidden transition-colors hover:border-primary/50",
        className,
      )}
    >
      {/* Thumbnail / Preview */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted/50">
        {thumbnail ? (
          <Image
            src={thumbnail}
            alt={name}
            fill
            className="object-cover"
          />
        ) : previewHtml ? (
          <HtmlPreview html={previewHtml} />
        ) : (
          <div
            className={cn(
              "flex h-full w-full items-center justify-center bg-gradient-to-br",
              gradientFor(name),
            )}
          >
            <span className="text-3xl font-bold text-white/40">
              {name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
      </div>
      <CardHeader className="p-3 pb-1">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="line-clamp-2 text-sm leading-snug">{name}</CardTitle>
          <Badge variant="outline" className="shrink-0 text-[10px]">
            Design
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="mt-auto px-3 pb-3">
        {updatedAt && (
          <p className="text-[10px] text-muted-foreground/70">{updatedAt}</p>
        )}
      </CardContent>
    </Card>
  );

  if (id) {
    return (
      <Link href={`/design/${id}`} className="block h-full">
        {content}
      </Link>
    );
  }

  return content;
}
