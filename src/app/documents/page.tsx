import { revalidatePath } from 'next/cache';
import { listDocuments } from '@/lib/db/queries/documents';
import { DocumentUploader } from '@/components/documents/DocumentUploader';
import { DocumentList } from '@/components/documents/DocumentList';
import { RetrievalTester } from '@/components/documents/RetrievalTester';

export const dynamic = 'force-dynamic';

async function refresh() {
  'use server';
  revalidatePath('/documents');
}

export default async function DocumentsPage() {
  const documents = await listDocuments();

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
      <DocumentUploader onUploaded={refresh} />
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-gray-700">Uploaded Documents</h2>
        <DocumentList documents={documents} />
      </section>
      <RetrievalTester />
    </main>
  );
}
