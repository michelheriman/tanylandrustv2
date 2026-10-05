import { paths } from './iconPaths.js'

export default function Icon({ name, size = 18, className = '' }) {
  return <svg className={className} viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" dangerouslySetInnerHTML={{ __html: paths[name] || paths.info }} />
}
