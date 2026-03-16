import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { cn } from "../../lib/utils"

interface ResponseProps {
  content: string
  className?: string
  isStreaming?: boolean
}

export function Response({ content, className, isStreaming }: ResponseProps) {
  return (
    <div className={cn("response-container", className)}>
      <div className="prose prose-lg max-w-none 
        prose-headings:text-foreground prose-headings:font-semibold 
        prose-p:text-foreground prose-p:leading-[1.75] prose-p:text-[15px]
        prose-ul:text-foreground prose-ol:text-foreground prose-li:text-foreground
        prose-strong:text-foreground prose-strong:font-semibold
        prose-code:text-foreground prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:text-[13px] prose-code:font-mono
        prose-pre:bg-muted prose-pre:border prose-pre:border-border prose-pre:rounded-lg prose-pre:p-4
        prose-a:text-foreground prose-a:underline prose-a:underline-offset-2 hover:prose-a:text-muted-foreground
        prose-blockquote:text-muted-foreground prose-blockquote:border-l-foreground prose-blockquote:pl-4
        prose-table:text-foreground prose-th:text-foreground prose-td:text-foreground">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ children }) => (
              <h1 className="text-2xl font-bold mb-4 mt-6 text-foreground first:mt-0 border-b border-border pb-2">
                {children}
              </h1>
            ),
            h2: ({ children }) => (
              <h2 className="text-xl font-semibold mb-3 mt-5 text-foreground first:mt-0">
                {children}
              </h2>
            ),
            h3: ({ children }) => (
              <h3 className="text-lg font-semibold mb-2 mt-4 text-foreground first:mt-0">
                {children}
              </h3>
            ),
            h4: ({ children }) => (
              <h4 className="text-base font-semibold mb-2 mt-3 text-foreground first:mt-0">
                {children}
              </h4>
            ),
            p: ({ children }) => (
              <p className="my-3 text-foreground leading-[1.75] text-[15px]">
                {children}
              </p>
            ),
            ul: ({ children }) => (
              <ul className="list-disc list-outside space-y-2 my-4 ml-6 text-foreground">
                {children}
              </ul>
            ),
            ol: ({ children }) => (
              <ol className="list-decimal list-outside space-y-2 my-4 ml-6 text-foreground">
                {children}
              </ol>
            ),
            li: ({ children }) => (
              <li className="text-foreground leading-[1.75] pl-1">
                {children}
              </li>
            ),
            code: ({ children, className }) => {
              const isInline = !className
              return isInline ? (
                <code className="bg-muted text-foreground px-1.5 py-0.5 rounded-md text-[13px] font-mono">
                  {children}
                </code>
              ) : (
                <code className="block bg-transparent text-foreground px-0 py-0 text-[14px] font-mono">
                  {children}
                </code>
              )
            },
            pre: ({ children }) => (
              <pre className="bg-muted border border-border p-4 rounded-lg overflow-x-auto my-3 text-[14px] font-mono leading-relaxed">
                {children}
              </pre>
            ),
            blockquote: ({ children }) => (
              <blockquote className="border-l-2 border-foreground pl-4 my-4 italic text-muted-foreground">
                {children}
              </blockquote>
            ),
            a: ({ href, children }) => (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground underline underline-offset-2 hover:text-muted-foreground transition-colors"
              >
                {children}
              </a>
            ),
            strong: ({ children }) => (
              <strong className="font-semibold text-foreground">
                {children}
              </strong>
            ),
            em: ({ children }) => (
              <em className="italic text-foreground">
                {children}
              </em>
            ),
            hr: () => (
              <hr className="my-6 border-border" />
            ),
            table: ({ children }) => (
              <div className="overflow-x-auto my-4">
                <table className="min-w-full border-collapse border border-border rounded-lg">
                  {children}
                </table>
              </div>
            ),
            thead: ({ children }) => (
              <thead className="bg-muted">
                {children}
              </thead>
            ),
            tbody: ({ children }) => (
              <tbody className="divide-y divide-border">
                {children}
              </tbody>
            ),
            tr: ({ children }) => (
              <tr className="border-b border-border hover:bg-muted/50 transition-colors">
                {children}
              </tr>
            ),
            th: ({ children }) => (
              <th className="px-4 py-3 text-left text-foreground font-semibold border border-border bg-muted text-sm">
                {children}
              </th>
            ),
            td: ({ children }) => (
              <td className="px-4 py-3 text-foreground border border-border text-sm">
                {children}
              </td>
            ),
          }}
        >
          {content.replace(/\[STEP:\s*\d+\]/g, "")}
        </ReactMarkdown>
      </div>
    </div>
  )
}
