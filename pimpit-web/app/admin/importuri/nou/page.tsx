import ImportWizard from '@/components/admin/ImportWizard';

export default function ImportNouPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Adaugă sursă de produse</h1>
        <p className="text-muted-foreground mt-1">Configurează un feed nou și mapează câmpurile spre produsele tale.</p>
      </div>
      <ImportWizard />
    </div>
  );
}
