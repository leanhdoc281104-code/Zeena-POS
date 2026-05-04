
export const printReceiptBluetooth = async (imageBuffer: ArrayBuffer) => {
  try {
    if (!(navigator as any).bluetooth) {
      throw new Error('Web Bluetooth API is not available in this browser.');
    }

    const device = await (navigator as any).bluetooth.requestDevice({
      filters: [
        { namePrefix: 'XP-' },
        { namePrefix: 'Xprinter' },
        { services: ['000018f0-0000-1000-8000-00805f9b34fb'] }
      ],
      optionalServices: [
        '000018f0-0000-1000-8000-00805f9b34fb',
        'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
        '0000fee7-0000-1000-8000-00805f9b34fb'
      ]
    });

    const server = await device.gatt?.connect();
    if (!server) throw new Error('Failed to connect to printer');

    const services = await server.getPrimaryServices();
    let printChar: any | null = null;

    for (const service of services) {
      const chars = await service.getCharacteristics();
      for (const char of chars) {
        if (char.properties && (char.properties.write || char.properties.writeWithoutResponse)) {
          printChar = char;
          break;
        }
      }
      if (printChar) break;
    }

    if (!printChar) throw new Error('No writable characteristic found on this device');

    // Send data in chunks
    const data = new Uint8Array(imageBuffer);
    const chunkSize = 512;
    for (let i = 0; i < data.length; i += chunkSize) {
      await printChar.writeValue(data.slice(i, i + chunkSize));
    }

    // Small delay to ensure printer processes buffer before disconnect
    await new Promise(resolve => setTimeout(resolve, 1000));

    server.disconnect();
    return true;
  } catch (error) {
    console.error('Bluetooth print error:', error);
    throw error;
  }
};
