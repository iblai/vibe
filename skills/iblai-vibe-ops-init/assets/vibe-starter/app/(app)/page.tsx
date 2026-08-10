
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="text-center space-y-6">
        <div className="flex items-center justify-center gap-3">
          <img
            src="https://ibl.ai/images/iblai-logo.png"
            alt="ibl.ai"
            className="h-10 w-auto"
          />
        </div>
        <h1 className="bg-gradient-to-r from-[#00b0ef] to-[#0058cc] text-transparent bg-clip-text font-bold text-4xl">
          Welcome to ibl.ai
        </h1>
        <p className="text-muted-foreground text-sm max-w-md mx-auto">
          Your app is ready. Add features with the ibl.ai CLI or start building.
        </p>
        <div className="flex gap-3 justify-center">
          <a
            href="https://docs.ibl.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-[#2563EB] to-[#93C5FD]"
          >
            Documentation
          </a>
          <a
            href="https://github.com/iblai/iblai-app-cli"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
          >
            GitHub
          </a>
        </div>
        <div className="mt-8 text-xs text-muted-foreground font-mono space-y-1">
          <p>iblai add chat &nbsp;&middot;&nbsp; iblai add profile &nbsp;&middot;&nbsp; iblai add analytics</p>
        </div>
      </div>
    </main>
  );
}
