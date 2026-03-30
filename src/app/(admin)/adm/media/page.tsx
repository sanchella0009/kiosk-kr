import { MediaUploadForm } from "@/components/admin/MediaUploadForm";
import { MediaGallery } from "@/components/admin/MediaGallery";

export default async function MediaAdminPage() {
  return (
    <div className="list">
      <div className="admin-card">
        <h1>Медиа</h1>
        <MediaUploadForm endpoint="/api/media/main" mode="main" />
      </div>
      <div className="admin-card">
        <h2>Список</h2>
        <MediaGallery category="MAIN" />
      </div>
    </div>
  );
}
