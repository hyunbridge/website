import { createBrowserRouter } from "react-router-dom"
import {
  AdminBlogEditRoute,
  AdminBlogPostsRoute,
  AdminDashboardRoute,
  AdminHomeRoute,
  AdminLayoutRoute,
  AdminLoginRoute,
  AdminProfileRoute,
  AdminProjectEditRoute,
  AdminProjectsRoute,
  AdminDeployRoute,
  AdminTagsPostsRoute,
  AdminTagsRoute,
  NotFoundRoute,
} from "./routes/app-routes"

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AdminLayoutRoute />,
    children: [
      { index: true, element: <AdminDashboardRoute /> },
      { path: "login", element: <AdminLoginRoute /> },
      { path: "blog", element: <AdminBlogPostsRoute /> },
      { path: "blog/posts", element: <AdminBlogPostsRoute /> },
      { path: "blog/edit/:id", element: <AdminBlogEditRoute /> },
      { path: "projects", element: <AdminProjectsRoute /> },
      { path: "projects/edit/:id", element: <AdminProjectEditRoute /> },
      { path: "pages", element: <AdminHomeRoute /> },
      { path: "pages/home", element: <AdminHomeRoute /> },
      { path: "deploy", element: <AdminDeployRoute /> },
      { path: "publish", element: <AdminDeployRoute /> },
      { path: "tags", element: <AdminTagsRoute /> },
      { path: "tags/:id/posts", element: <AdminTagsPostsRoute /> },
      { path: "profile", element: <AdminProfileRoute /> },
      { path: "*", element: <NotFoundRoute /> },
    ],
  },
])
