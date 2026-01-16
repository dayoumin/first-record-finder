'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
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
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  children?: NavItem[];
  disabled?: boolean;
}

const navItems: NavItem[] = [
  { title: '최초기록', href: '/first-record', icon: FileSearch },
  { title: '학명검증', href: '/validation', icon: CheckCircle, badge: '준비중' },
  {
    title: '문헌정보',
    href: '/literature',
    icon: BookOpen,
    children: [
      { title: '논문', href: '/literature/papers', icon: FileText },
      { title: '특허', href: '/literature/patents', icon: Lightbulb },
      { title: '보고서', href: '/literature/reports', icon: ClipboardList },
    ],
  },
  { title: '통계분석', href: '/statistics', icon: BarChart3, badge: '준비중' },
  { title: '추가정보', href: '/info', icon: Info },
];

const bottomNavItems: NavItem[] = [
  { title: '커뮤니티', href: '/community', icon: Users, disabled: true, badge: '예정' },
  { title: '설정', href: '/settings', icon: Settings },
];

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [openMenus, setOpenMenus] = useState<string[]>(['/literature']);

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
        <TooltipProvider key={item.href} delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground/50 cursor-not-allowed',
                  isChild && 'ml-6',
                  isCollapsed && 'justify-center px-2'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {!isCollapsed && (
                  <>
                    <span className="flex-1 truncate">{item.title}</span>
                    {item.badge && (
                      <Badge variant="outline" className="text-xs opacity-50">
                        {item.badge}
                      </Badge>
                    )}
                  </>
                )}
              </div>
            </TooltipTrigger>
            {isCollapsed && (
              <TooltipContent side="right">
                <p>{item.title} (준비중)</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      );
    }

    if (hasChildren) {
      return (
        <Collapsible
          key={item.href}
          open={isOpen && !isCollapsed}
          onOpenChange={() => toggleMenu(item.href)}
        >
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <CollapsibleTrigger asChild>
                  <button
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
                      active && 'bg-accent text-accent-foreground',
                      isCollapsed && 'justify-center px-2'
                    )}
                    aria-expanded={isOpen}
                    aria-label={item.title}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {!isCollapsed && (
                      <>
                        <span className="flex-1 truncate text-left">{item.title}</span>
                        {isOpen ? (
                          <ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" />
                        ) : (
                          <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                        )}
                      </>
                    )}
                  </button>
                </CollapsibleTrigger>
              </TooltipTrigger>
              {isCollapsed && (
                <TooltipContent side="right">
                  <p>{item.title}</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
          <CollapsibleContent className="space-y-1 pt-1">
            {item.children?.map((child) => renderNavItem(child, true))}
          </CollapsibleContent>
        </Collapsible>
      );
    }

    return (
      <TooltipProvider key={item.href} delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                active && 'bg-primary/10 text-primary font-medium',
                isChild && 'ml-6',
                isCollapsed && 'justify-center px-2'
              )}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {!isCollapsed && (
                <>
                  <span className="flex-1 truncate">{item.title}</span>
                  {item.badge && (
                    <Badge
                      variant="secondary"
                      className="text-xs"
                    >
                      {item.badge}
                    </Badge>
                  )}
                </>
              )}
            </Link>
          </TooltipTrigger>
          {isCollapsed && (
            <TooltipContent side="right">
              <p>{item.title}</p>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
    );
  };

  return (
    <aside
      className={cn(
        'hidden md:flex flex-col border-r bg-background transition-all duration-300',
        isCollapsed ? 'w-16' : 'w-64',
        className
      )}
      role="navigation"
      aria-label="메인 네비게이션"
    >
      {/* 사이드바 헤더 - 축소/펼침 버튼 */}
      <div className="flex h-14 items-center justify-end px-3 border-b">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(!isCollapsed)}
          aria-label={isCollapsed ? '사이드바 펼치기' : '사이드바 축소'}
          className="h-8 w-8"
        >
          {isCollapsed ? (
            <PanelLeft className="h-4 w-4" aria-hidden="true" />
          ) : (
            <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
          )}
        </Button>
      </div>

      {/* 메인 네비게이션 */}
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-1" aria-label="주요 메뉴">
          {navItems.map((item) => renderNavItem(item))}
        </nav>
      </ScrollArea>

      {/* 하단 네비게이션 */}
      <div className="mt-auto border-t px-3 py-4">
        <Separator className="mb-4" />
        <nav className="space-y-1" aria-label="추가 메뉴">
          {bottomNavItems.map((item) => renderNavItem(item))}
        </nav>
      </div>
    </aside>
  );
}
