'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Menu,
  FileSearch,
  CheckCircle,
  BookOpen,
  FileText,
  Lightbulb,
  ClipboardList,
  BarChart3,
  Info,
  Users,
  Settings,
  ChevronDown,
  ChevronRight,
  Fish,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  description?: string;
  badge?: string;
  children?: NavItem[];
  disabled?: boolean;
}

const navItems: NavItem[] = [
  {
    title: '최초기록',
    href: '/first-record',
    icon: FileSearch,
    description: '한국 최초 서식 기록 문헌 검색',
  },
  {
    title: '학명검증',
    href: '/validation',
    icon: CheckCircle,
    description: 'WoRMS/CoL 기반 학명 검증',
    badge: '준비중',
  },
  {
    title: '문헌정보',
    href: '/literature',
    icon: BookOpen,
    description: '논문/특허/보고서 검색',
    children: [
      { title: '논문', href: '/literature/papers', icon: FileText },
      { title: '특허', href: '/literature/patents', icon: Lightbulb },
      { title: '보고서', href: '/literature/reports', icon: ClipboardList },
    ],
  },
  {
    title: '통계분석',
    href: '/statistics',
    icon: BarChart3,
    description: '전문가급 통계 분석',
    badge: '준비중',
  },
  {
    title: '추가정보',
    href: '/info',
    icon: Info,
    description: '유용한 참고 자료',
  },
];

const bottomNavItems: NavItem[] = [
  {
    title: '커뮤니티',
    href: '/community',
    icon: Users,
    description: '사용자 정보 공유',
    disabled: true,
    badge: '예정',
  },
  {
    title: '설정',
    href: '/settings',
    icon: Settings,
    description: '앱 설정',
  },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const [openMenus, setOpenMenus] = useState<string[]>([]);
  const pathname = usePathname();

  const toggleMenu = (href: string) => {
    setOpenMenus((prev) =>
      prev.includes(href) ? prev.filter((h) => h !== href) : [...prev, href]
    );
  };

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(href + '/');
  };

  const renderNavItem = (item: NavItem, isChild = false) => {
    const Icon = item.icon;
    const active = isActive(item.href);
    const hasChildren = item.children && item.children.length > 0;
    const isOpen = openMenus.includes(item.href);

    if (item.disabled) {
      return (
        <div
          key={item.href}
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-3 text-muted-foreground/50 cursor-not-allowed',
            isChild && 'ml-6 py-2'
          )}
        >
          <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
          <div className="flex flex-col flex-1">
            <div className="flex items-center gap-2">
              <span>{item.title}</span>
              {item.badge && (
                <Badge variant="outline" className="text-xs opacity-50">
                  {item.badge}
                </Badge>
              )}
            </div>
            {item.description && !isChild && (
              <span className="text-xs">{item.description}</span>
            )}
          </div>
        </div>
      );
    }

    if (hasChildren) {
      return (
        <Collapsible
          key={item.href}
          open={isOpen}
          onOpenChange={() => toggleMenu(item.href)}
        >
          <CollapsibleTrigger asChild>
            <button
              className={cn(
                'flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm transition-colors',
                'hover:bg-accent hover:text-accent-foreground',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                active ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
              )}
              aria-expanded={isOpen}
            >
              <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
              <div className="flex flex-col flex-1 text-left">
                <span>{item.title}</span>
                {item.description && (
                  <span className="text-xs text-muted-foreground">
                    {item.description}
                  </span>
                )}
              </div>
              {isOpen ? (
                <ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" />
              ) : (
                <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
              )}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-1 pt-1">
            {item.children?.map((child) => renderNavItem(child, true))}
          </CollapsibleContent>
        </Collapsible>
      );
    }

    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setOpen(false)}
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 text-sm transition-colors',
          'hover:bg-accent hover:text-accent-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          isChild ? 'ml-6 py-2' : 'py-3',
          active
            ? 'bg-primary/10 text-primary font-medium'
            : 'text-muted-foreground'
        )}
        aria-current={active ? 'page' : undefined}
      >
        <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
        <div className="flex flex-col flex-1">
          <div className="flex items-center gap-2">
            <span>{item.title}</span>
            {item.badge && (
              <Badge variant="secondary" className="text-xs">
                {item.badge}
              </Badge>
            )}
          </div>
          {item.description && !isChild && (
            <span className="text-xs text-muted-foreground">
              {item.description}
            </span>
          )}
        </div>
      </Link>
    );
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={() => setOpen(true)}
        aria-label="메뉴 열기"
        aria-expanded={open}
        aria-controls="mobile-nav"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <SheetContent side="left" id="mobile-nav" aria-label="모바일 네비게이션">
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2">
            <Fish className="h-5 w-5 text-primary" aria-hidden="true" />
            Marine Science Platform
          </SheetTitle>
          <SheetDescription>
            수산과학 연구자를 위한 통합 플랫폼
          </SheetDescription>
        </SheetHeader>

        <nav className="mt-6 flex flex-col gap-1" role="navigation" aria-label="주요 메뉴">
          {navItems.map((item) => renderNavItem(item))}
        </nav>

        <Separator className="my-4" />

        <nav className="flex flex-col gap-1" role="navigation" aria-label="추가 메뉴">
          {bottomNavItems.map((item) => renderNavItem(item))}
        </nav>

        <div className="absolute bottom-6 left-6 right-6">
          <p className="text-xs text-muted-foreground text-center">
            Marine Science Platform v0.2.0
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
