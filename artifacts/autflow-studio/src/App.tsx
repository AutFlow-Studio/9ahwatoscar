import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { ThemeProvider } from '@/components/theme-provider';
import { AgencyProfileProvider } from '@/components/agency-profile-provider';
import { AuthProvider, useAuth } from '@/components/auth-provider';
import { ErrorBoundary } from '@/components/error-boundary';
import { Layout } from '@/components/layout';
import LoginPage from '@/pages/login/index';

import Dashboard from '@/pages/dashboard';
import ClientsList from '@/pages/clients/index';
import ClientDetail from '@/pages/clients/detail';
import ProjectsList from '@/pages/projects/index';
import ProjectDetail from '@/pages/projects/detail';
import PaymentsList from '@/pages/payments/index';
import CalendarView from '@/pages/calendar/index';
import DocumentsList from '@/pages/documents/index';
import ReportsView from '@/pages/reports/index';
import TasksList from '@/pages/tasks/index';
import SearchResults from '@/pages/search/index';
import SettingsView from '@/pages/settings/index';
import MeetingsList from '@/pages/meetings/index';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: unknown) => {
        // Don't retry on 401/403
        const status = (error as { status?: number })?.status;
        if (status === 401 || status === 403) return false;
        return failureCount < 2;
      },
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/clients" component={ClientsList} />
      <Route path="/clients/:id" component={ClientDetail} />
      <Route path="/projects" component={ProjectsList} />
      <Route path="/projects/:id" component={ProjectDetail} />
      <Route path="/payments" component={PaymentsList} />
      <Route path="/meetings" component={MeetingsList} />
      <Route path="/calendar" component={CalendarView} />
      <Route path="/documents" component={DocumentsList} />
      <Route path="/reports" component={ReportsView} />
      <Route path="/tasks" component={TasksList} />
      <Route path="/search" component={SearchResults} />
      <Route path="/settings" component={SettingsView} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthGate() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Loading…</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <Layout>
      <Router />
    </Layout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark" storageKey="autflow-studio-theme">
        <AuthProvider>
          <AgencyProfileProvider>
            <QueryClientProvider client={queryClient}>
              <TooltipProvider>
                <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
                  <AuthGate />
                </WouterRouter>
                <Toaster />
              </TooltipProvider>
            </QueryClientProvider>
          </AgencyProfileProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
