"use client";

import Link from "next/link";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ProjectCardProps {
  id?: string;
  name: string;
  description?: string | null;
  thumbnail?: string | null;
  updatedAt?: string;
  className?: string;
}

export function ProjectCard({
  id,
  name,
  description,
  thumbnail,
  updatedAt,
  className,
}: ProjectCardProps) {
  const content = (
    <Card
      className={cn(
        "group overflow-hidden transition-colors hover:border-primary/50",
        className,
      )}
    >
      {/* Thumbnail placeholder */}
      {thumbnail ? (
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
          <Image
            src={thumbnail}
            alt={name}
            fill
            className="object-cover"
          />
        </div>
      ) : (
        <div className="flex aspect-[16/10] w-full items-center justify-center bg-muted/50">
          <div className="text-2xl font-bold text-muted-foreground/20">
            {name.charAt(0).toUpperCase()}
          </div>
        </div>
      )}
      <CardHeader className="p-3 pb-1">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="truncate text-sm">{name}</CardTitle>
          <Badge variant="secondary" className="shrink-0 text-[10px]">
            Project
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="px-3 pb-3">
        {description && (
          <p className="truncate text-xs text-muted-foreground">
            {description}
          </p>
        )}
        {updatedAt && (
          <p className="mt-1 text-[10px] text-muted-foreground/70">
            {updatedAt}
          </p>
        )}
      </CardContent>
    </Card>
  );

  if (id) {
    return (
      <Link href={`/project/${id}`} className="block">
        {content}
      </Link>
    );
  }

  return content;
}
