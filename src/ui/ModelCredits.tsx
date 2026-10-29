import { useEffect, useState } from 'react'

/**
 * Who made the meshes.
 *
 * Eight of the setup parts are drawn with photoscanned models from
 * Sketchfab under CC-BY-4.0. That licence is not CC0: it allows the use and
 * the modification, and in exchange it requires the author to be credited
 * wherever the work is shown. `public/models/LICENSES.md` records them for
 * whoever maintains this, which is necessary and is not the same thing —
 * the obligation is to the people looking at the page, not to the
 * repository.
 *
 * So this is the credit, and it is on the page that shows the renders.
 *
 * Read out of the catalogue rather than typed out here. A second hand-kept
 * list is a list that goes stale the first time somebody swaps a model, and
 * a stale attribution is worse than none: it credits the wrong person. The
 * part definitions already carry the title, the author and the source, so
 * those are the only copy of that fact.
 */

interface Credit {
  title: string
  author: string
  license: string
  source: string
}

function useModelCredits(): Credit[] {
  const [list, setList] = useState<Credit[]>([])

  useEffect(() => {
    let live = true
    void import('@/parts/catalog').then((m) => {
      if (!live) return
      const seen = new Map<string, Credit>()
      for (const def of m.allParts()) {
        /*
         * `model` may be a function of the parameters, because a part can
         * answer with different meshes per configuration. Asking it with the
         * defaults is enough: every branch of every part in this catalogue
         * points at the same file and therefore the same author, and a
         * credit list is about people rather than about variants.
         */
        const spec = typeof def.model === 'function' ? def.model(m.defaultParams(def)) : def.model
        const c = spec?.credit
        if (c) seen.set(c.source, c)
      }
      setList([...seen.values()].sort((a, b) => a.author.localeCompare(b.author)))
    })
    return () => {
      live = false
    }
  }, [])

  return list
}

export function ModelCredits({ className }: { className?: string }) {
  const credits = useModelCredits()
  if (credits.length === 0) return null

  return (
    <section className={`credits${className ? ` ${className}` : ''}`}>
      <h3>Models</h3>
      <p className="credits-lede">
        Some parts are drawn with scanned models. Their authors are below.
      </p>
      <ul>
        {credits.map((c) => (
          <li key={c.source}>
            <a href={c.source} target="_blank" rel="noreferrer noopener">
              {c.title}
            </a>
            <span className="credits-by">
              {c.author} · {c.license}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
