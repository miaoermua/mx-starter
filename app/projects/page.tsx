import Link from 'next/link'
import { fetchProjects } from '@/lib/api'

/**
 * 项目页（ProjectPage）
 *
 * core v12.x 新增 Project 模块，GET /projects 访客可读。
 * DOM 契约：section.page-title + section.page-content > .projects-list。
 */
export default async function ProjectsPage() {
  const projects = await fetchProjects()

  return (
    <main>
      <div className="wrap min">
        <section className="page-title">
          <h2>项目</h2>
        </section>
        <section className="page-content">
          {projects.length > 0 ? (
            <div className="projects-list">
              {projects.map((project) => {
                const home = project.projectUrl || project.previewUrl
                return (
                  <div className="project-item" key={project.id}>
                    {project.avatar && (
                      // 头像由 core 直接给出 URL，主题作者决定尺寸
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        className="project-avatar"
                        src={project.avatar}
                        alt={project.name}
                        loading="lazy"
                      />
                    )}
                    <div className="project-info">
                      <h3>
                        {home ? (
                          <a href={home} target="_blank" rel="noopener noreferrer">
                            {project.name}
                          </a>
                        ) : (
                          project.name
                        )}
                      </h3>
                      {project.description && <p>{project.description}</p>}
                      {project.docUrl && (
                        <Link className="project-doc" href={project.docUrl}>
                          文档
                        </Link>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p>还没有项目 (QWQ)</p>
          )}
        </section>
      </div>
    </main>
  )
}
