// React component for displaying environment errors

interface EnvironmentErrorProps {
  errors: string[];
}

export function EnvironmentError({ errors }: EnvironmentErrorProps) {
  if (errors.length === 0) return null;

  return (
    <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-2xl w-full">
        <div className="text-center mb-6">
          <div className="text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-red-600 mb-2">
            Configuration Error
          </h1>
          <p className="text-gray-600">
            The application is missing required environment variables
          </p>
        </div>
        
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <h2 className="font-semibold text-red-800 mb-2">Issues found:</h2>
          <ul className="list-disc list-inside space-y-1 text-red-700">
            {errors.map((error, index) => (
              <li key={index} className="text-sm">{error}</li>
            ))}
          </ul>
        </div>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h2 className="font-semibold text-blue-800 mb-2">Quick Fix:</h2>
          <ol className="list-decimal list-inside space-y-1 text-blue-700 text-sm">
            <li>Create <code className="bg-blue-100 px-1 rounded">frontend/.env.local</code> file</li>
            <li>Add your Supabase credentials from dashboard</li>
            <li>Restart the development server</li>
          </ol>
          
          <div className="mt-4 p-3 bg-blue-100 rounded font-mono text-xs">
            <div>NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co</div>
            <div>NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key</div>
          </div>
          
          <p className="mt-3 text-xs text-blue-600">
            Get credentials from: 
            <a 
              href="https://supabase.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="underline ml-1"
            >
              Supabase Dashboard → Settings → API
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}