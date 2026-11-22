import { documentoStorageService } from './src/core/storage/documento-storage.service.js';

async function testObtener() {
  try {
    const buf = await documentoStorageService.obtenerObjetoS3('expedientes/02a4fa64-2648-4933-96d1-529261770199/cargos/b85216e8-2557-48f3-8255-6f8b71e481e8.pdf');
    console.log('OBTENER SUCCESS, bytes:', buf.length);
  } catch (err) {
    console.error('OBTENER ERROR:', err);
  }
}
testObtener();
