import {
  DeviceCommunicationError,
  DeviceCommunicationErrorType,
  DeviceConnectionError,
  DeviceConnectionErrorType,
  IDeviceConnection,
} from '@cypherock/sdk-interfaces';
import { logger, PacketVersion, PacketVersionMap } from '../../utils';
import { DecodedPacketData } from '../../encoders/packet';

import { waitForPacket } from './waitForPacket';
import assert from '../../utils/assert';

export const writeCommand = async ({
  connection,
  packet,
  version,
  sequenceNumber,
  ackPacketTypes,
}: {
  connection: IDeviceConnection;
  packet: Uint8Array;
  version: PacketVersion;
  sequenceNumber: number;
  ackPacketTypes: number[];
}): Promise<DecodedPacketData> => {
  assert(connection, 'Invalid connection');
  assert(packet, 'Invalid packet');
  assert(version, 'Invalid version');
  assert(ackPacketTypes, 'Invalid ackPacketTypes');
  assert(sequenceNumber, 'Invalid sequenceNumber');

  assert(
    ackPacketTypes.length > 0,
    'ackPacketTypes should contain atleast 1 element',
  );
  assert(packet.length > 0, 'packet cannot be empty');

  if (version !== PacketVersionMap.v3) {
    throw new Error('Only v3 packets are supported');
  }

  if (!connection.isConnected()) {
    throw new DeviceConnectionError(
      DeviceConnectionErrorType.CONNECTION_CLOSED,
    );
  }

  // eslint-disable-next-line no-async-promise-executor
  return new Promise<DecodedPacketData>(async (resolve, reject) => {
    const ackPromise = waitForPacket({
      connection,
      version,
      packetTypes: ackPacketTypes,
      sequenceNumber,
    });

    connection.send(packet).catch((error: any) => {
      logger.error(error);
      if (!connection.isConnected()) {
        reject(
          new DeviceConnectionError(
            DeviceConnectionErrorType.CONNECTION_CLOSED,
          ),
        );
      } else {
        reject(
          new DeviceCommunicationError(
            DeviceCommunicationErrorType.WRITE_ERROR,
          ),
        );
      }
      ackPromise.cancel();
    });

    ackPromise
      .then(res => {
        if (ackPromise.isCancelled()) {
          return;
        }

        resolve(res);
      })
      .catch(error => {
        if (ackPromise.isCancelled()) {
          return;
        }

        reject(error);
      });
  });
};
