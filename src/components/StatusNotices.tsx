export function DemoNotice() {
  return <p className="notice notice--demo"><strong>Demonstration data</strong> — not reviewed linguistic content.</p>;
}

export function DatabaseNotice() {
  return (
    <div className="notice" role="status">
      <strong>The database is not connected.</strong> Start PostgreSQL, run the migrations, and optionally load the demonstration data.
    </div>
  );
}
