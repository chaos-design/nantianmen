"use client"

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import type * as React from "react"
import {
  type ChevronProps,
  type DayButton,
  DayPicker,
  getDefaultClassNames,
  type Locale,
} from "react-day-picker"
import { zhCN } from "react-day-picker/locale"

import { cn } from "../../lib/utils"
import { Button, buttonVariants } from "./button"

/**
 * shadcn/ui 的 Calendar 组件，基于 react-day-picker。
 *
 * 默认接入项目的中文区域设置和设计令牌：只有在这里覆写字面量，
 * 上层业务组件才不需要各自传 locale 与 formatter。
 */
function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "label",
  buttonVariant = "ghost",
  locale = zhCN,
  formatters,
  components,
  ...props
}: React.ComponentProps<typeof DayPicker> & {
  buttonVariant?: React.ComponentProps<typeof Button>["variant"]
}) {
  const defaultClassNames = getDefaultClassNames()

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("bg-background group/calendar p-3", className)}
      classNames={{
        root: cn("w-fit", defaultClassNames.root),
        months: cn(
          "flex gap-4 flex-col md:flex-row relative",
          defaultClassNames.months,
        ),
        month: cn("flex flex-col w-full gap-4", defaultClassNames.month),
        nav: cn(
          "flex items-center gap-1 w-full absolute top-0 inset-x-0 justify-between",
          defaultClassNames.nav,
        ),
        button_previous: cn(
          buttonVariants({ variant: buttonVariant }),
          "size-8 aria-disabled:opacity-50 p-0 select-none",
          defaultClassNames.button_previous,
        ),
        button_next: cn(
          buttonVariants({ variant: buttonVariant }),
          "size-8 aria-disabled:opacity-50 p-0 select-none",
          defaultClassNames.button_next,
        ),
        month_caption: cn(
          "flex items-center justify-center h-8 w-full px-8 relative z-10",
          defaultClassNames.month_caption,
        ),
        caption_label: cn(
          "select-none font-medium text-sm",
          defaultClassNames.caption_label,
        ),
        weekdays: cn("flex", defaultClassNames.weekdays),
        weekday: cn(
          "text-muted-foreground rounded-md flex-1 font-normal text-[0.8rem] select-none",
          defaultClassNames.weekday,
        ),
        week: cn("flex w-full mt-2", defaultClassNames.week),
        day: cn(
          "relative w-full h-full p-0 text-center group/day aspect-square select-none",
          "rounded-md",
          defaultClassNames.day,
        ),
        today: cn(
          "bg-accent text-accent-foreground rounded-md data-[selected=true]:rounded-none",
          defaultClassNames.today,
        ),
        outside: cn(
          "text-muted-foreground aria-selected:text-muted-foreground",
          defaultClassNames.outside,
        ),
        disabled: cn("text-muted-foreground opacity-50", defaultClassNames.disabled),
        hidden: cn("invisible", defaultClassNames.hidden),
        ...classNames,
      }}
      captionLayout={captionLayout}
      locale={locale}
      formatters={{
        formatMonthDropdown: (date) =>
          date.toLocaleString(locale?.code, { month: "short" }),
        ...formatters,
      }}
      components={{
        Chevron: CalendarChevron,
        DayButton: CalendarDayButton,
        ...components,
      }}
      {...props}
    />
  )
}

/**
 * 翻页箭头。
 *
 * 定义在模块层而不是 Calendar 内部：react-day-picker 会在每次渲染时把
 * components 传给内部组件，内联定义会让箭头组件每帧重建。
 */
function CalendarChevron({ className, orientation, ...props }: ChevronProps) {
  if (orientation === "left") {
    return <ChevronLeftIcon className={cn("size-4", className)} {...props} />
  }
  if (orientation === "up") {
    return (
      <ChevronRightIcon className={cn("size-4 -rotate-90", className)} {...props} />
    )
  }
  if (orientation === "down") {
    return <ChevronRightIcon className={cn("size-4 rotate-90", className)} {...props} />
  }
  return <ChevronRightIcon className={cn("size-4", className)} {...props} />
}

function CalendarDayButton({
  className,
  day,
  modifiers,
  locale,
  ...props
}: React.ComponentProps<typeof DayButton> & { locale?: Partial<Locale> }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      data-day={day.date.toLocaleDateString(locale?.code)}
      className={cn(
        "size-8 p-0 font-normal aria-selected:opacity-100",
        className,
        Boolean(modifiers.selected) &&
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        !modifiers.selected &&
          "hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
        modifiers.range_start && "bg-primary text-primary-foreground rounded-s-md",
        modifiers.range_end && "bg-primary text-primary-foreground rounded-e-md",
        modifiers.range_middle &&
          "rounded-none bg-accent text-accent-foreground hover:bg-accent",
        modifiers.today && !modifiers.selected && "bg-accent text-accent-foreground",
      )}
      {...props}
    />
  )
}

export { Calendar, CalendarDayButton }
