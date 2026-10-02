import { useEffect } from 'react';

interface ConsentimientoLey29733ModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ConsentimientoLey29733Modal({ isOpen, onClose }: ConsentimientoLey29733ModalProps) {
  if (!isOpen) {
    return null;
  }

  const handleEscapeKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      onClose();
    }
  };

  useEffect(() => {
    document.addEventListener('keydown', handleEscapeKey);
    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="consentimiento-modal-title"
        className="bg-white rounded-lg p-6 max-w-lg max-h-[80vh] overflow-y-auto w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 id="consentimiento-modal-title" className="text-xl font-semibold">
            Política de Tratamiento de Datos Personales y Domicilio Digital
          </h2>
          <button
            aria-label="Cerrar"
            className="text-gray-500 hover:text-gray-700"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <p className="mb-4 text-gray-700">
          El IESTP "Suiza" trata los datos personales de los postulantes conforme a la Ley N° 29733 (Ley de Protección de Datos Personales) y su reglamento, con fines exclusivos del proceso de admisión y matrícula.
        </p>

        <p className="mb-4 text-gray-700">
          La "Casilla Electrónica Institucional" constituye el domicilio digital del postulante en el proceso de admisión. Las notificaciones oficiales (resultados, observaciones, requerimientos) se remiten válidamente a esa casilla, conforme al Art. 20 del TUO de la Ley N° 27444, y es responsabilidad del postulante revisarla periódicamente.
        </p>

        <p className="mb-6 text-gray-700">
          Usted puede ejercer en cualquier momento sus derechos de acceso, rectificación, cancelación y oposición respecto a sus datos personales dirigiéndose a la Mesa de Partes del IESTP Suiza o mediante comunicación formal a datos.personales@iestpsuiza.edu.pe, de conformidad con la Ley N° 29733.
        </p>

        <button
          onClick={onClose}
          className="w-full bg-[#006EC7] text-white py-3 rounded-lg font-medium hover:bg-[#005a9e] transition-colors"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}