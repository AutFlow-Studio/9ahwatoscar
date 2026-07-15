import { useGetCalendar } from "@workspace/api-client-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { format, startOfWeek, addDays, isSameDay } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export default function CalendarView() {
  const { data: events, isLoading, isError } = useGetCalendar();
  const today = new Date();
  const [weekOffset, setWeekOffset] = useState(0);
  const startDate = addDays(startOfWeek(today, { weekStartsOn: 1 }), weekOffset * 7); // Start on Monday

  // Generate a simple week view
  const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(startDate, i));

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Calendar" description="Deadlines, meetings, and milestones" />
        <Skeleton className="h-[600px] w-full rounded-xl" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <PageHeader title="Calendar" description="Deadlines, meetings, and milestones" />
        <Card className="bg-card/40 backdrop-blur-sm border-border/50">
          <CardContent className="flex flex-col items-center justify-center py-20 text-center gap-3">
            <p className="text-sm font-medium text-destructive">Failed to load calendar events</p>
            <p className="text-xs text-muted-foreground">Please refresh the page or check your connection.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getEventsForDay = (date: Date) => {
    return events?.filter(e => {
      const eventDate = new Date(e.date);
      return isSameDay(eventDate, date);
    }) || [];
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'meeting': return 'bg-blue-500/10 border-blue-500/30 text-blue-500';
      case 'deadline': return 'bg-amber-500/10 border-amber-500/30 text-amber-500';
      case 'payment_due': return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500';
      case 'contract_expiry': return 'bg-destructive/10 border-destructive/30 text-destructive';
      case 'project_launch': return 'bg-primary/10 border-primary/30 text-primary';
      default: return 'bg-secondary border-border text-foreground';
    }
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      <PageHeader title="Calendar" description="Deadlines, meetings, and milestones">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setWeekOffset((w) => w - 1)}>
            <ChevronLeft size={16} />
          </Button>
          <button
            type="button"
            className="px-4 font-medium text-sm hover:text-primary transition-colors"
            onClick={() => setWeekOffset(0)}
            title="Jump back to this week"
          >
            {weekOffset === 0 ? "This Week" : format(startDate, "MMM d") + " – " + format(addDays(startDate, 6), "MMM d")}
          </button>
          <Button variant="outline" size="icon" onClick={() => setWeekOffset((w) => w + 1)}>
            <ChevronRight size={16} />
          </Button>
        </div>
      </PageHeader>

      <Card className="flex-1 bg-card/40 backdrop-blur-sm border-border/50 overflow-hidden flex flex-col">
        <div className="grid grid-cols-7 border-b border-border/50 bg-secondary/30">
          {weekDays.map((day, i) => (
            <div key={i} className={`p-3 text-center border-r border-border/50 last:border-0 ${isSameDay(day, today) ? 'bg-primary/5' : ''}`}>
              <div className="text-xs font-medium text-muted-foreground uppercase mb-1">{format(day, "EEE")}</div>
              <div className={`text-lg font-bold w-8 h-8 mx-auto flex items-center justify-center rounded-full ${isSameDay(day, today) ? 'bg-primary text-primary-foreground' : ''}`}>
                {format(day, "d")}
              </div>
            </div>
          ))}
        </div>
        
        <div className="grid grid-cols-7 flex-1 min-h-[500px]">
          {weekDays.map((day, i) => {
            const dayEvents = getEventsForDay(day);
            return (
              <div key={i} className={`p-2 border-r border-border/50 last:border-0 ${isSameDay(day, today) ? 'bg-primary/5' : ''}`}>
                <div className="space-y-2">
                  {dayEvents.map(event => (
                    <div 
                      key={event.id} 
                      className={`p-2 rounded border text-xs leading-tight cursor-pointer hover:opacity-80 transition-opacity ${getEventColor(event.type)}`}
                    >
                      <div className="font-semibold mb-1 truncate" title={event.title}>{event.title}</div>
                      <div className="opacity-80 truncate">{event.clientName}</div>
                      <div className="mt-1 font-mono text-[10px] opacity-70">
                        {format(new Date(event.date), "h:mm a")}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}