import { useGlobalSearch, getGlobalSearchQueryKey } from "@workspace/api-client-react";
import { PageHeader } from "@/components/page-header";
import { useLocation } from "wouter";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Building2, 
  Briefcase, 
  CreditCard, 
  FileText, 
  Calendar,
  CheckSquare,
  ChevronRight,
  Search
} from "lucide-react";

export default function SearchResults() {
  const [location] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const query = searchParams.get("q") || "";

  const { data, isLoading } = useGlobalSearch(
    { q: query },
    { query: { enabled: query.length > 2, queryKey: getGlobalSearchQueryKey({ q: query }) } }
  );

  const getIconForType = (type: string) => {
    switch (type) {
      case 'client': return <Building2 className="text-blue-500" />;
      case 'project': return <Briefcase className="text-primary" />;
      case 'payment': return <CreditCard className="text-emerald-500" />;
      case 'note': case 'document': return <FileText className="text-amber-500" />;
      case 'meeting': return <Calendar className="text-purple-500" />;
      case 'task': return <CheckSquare className="text-pink-500" />;
      default: return <Search className="text-muted-foreground" />;
    }
  };

  const getLinkForType = (type: string, id: number, url?: string | null) => {
    // The backend already computes the right destination per result type
    // (including notes/meetings/tasks/documents), so trust it whenever present.
    if (url) return url;
    switch (type) {
      case 'client': return `/clients/${id}`;
      case 'project': return `/projects/${id}`;
      case 'payment': return `/payments`;
      default: return `/search`;
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <PageHeader 
        title={`Search results for "${query}"`} 
        description={data ? `Found ${data.total} results` : "Enter a search term above"}
      />

      {query.length <= 2 ? (
        <div className="text-center py-20 text-muted-foreground text-sm border rounded-xl bg-card/30 border-dashed">
          Please enter at least 3 characters to search.
        </div>
      ) : isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : !data || data.results.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground text-sm border rounded-xl bg-card/30 border-dashed">
          No results found for "{query}". Try different keywords.
        </div>
      ) : (
        <div className="grid gap-3">
          {data.results.map((result, i) => (
            <Link key={`${result.type}-${result.id}-${i}`} href={getLinkForType(result.type, result.id, result.url)}>
              <Card className="bg-card/40 backdrop-blur-sm border-border/50 hover:border-primary/50 transition-colors cursor-pointer group">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                      {getIconForType(result.type)}
                    </div>
                    <div>
                      <div className="font-semibold group-hover:text-primary transition-colors">{result.title}</div>
                      {result.subtitle && (
                        <div className="text-sm text-muted-foreground mt-0.5">{result.subtitle}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground bg-secondary px-2 py-1 rounded">
                      {result.type}
                    </span>
                    <ChevronRight size={16} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}