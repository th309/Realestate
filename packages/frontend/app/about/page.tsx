export default function AboutPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">About Us</h1>
        <p className="text-gray-600 mb-8">Learn more about PropertyIQ and our mission.</p>
        <a href="/map" className="px-6 py-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors">
          Back to Map
        </a>
      </div>
    </div>
  );
}
