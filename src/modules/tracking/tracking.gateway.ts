// src/modules/tracking/tracking.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { TrackingService } from './tracking.service';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: 'tracking',
})
export class TrackingGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  // Map active connections.
  private connectedClients = new Map<string, string>(); // socketId → tenantId

  constructor(
    private jwtService: JwtService,
    private trackingService: TrackingService,
  ) {}

  // ─── Connection ───────────────────────────────────────

  async handleConnection(client: Socket) {
    try {
      // Verify the JWT when the client connects.
      const token =
        client.handshake.auth.token ??
        client.handshake.headers.authorization?.split(' ')[1];

      if (!token) throw new Error('No token');

      const payload = this.jwtService.verify(token);

      // Store the tenant ID.
      this.connectedClients.set(client.id, payload.tenantId);

      // Join the tenant's room.
      client.join(`tenant:${payload.tenantId}`);

      console.log(
        `✅ Client connected: ${client.id} | Tenant: ${payload.tenantId}`,
      );

      // Send the initial data.
      const drivers = await this.trackingService.getActiveDriversLocations(
        payload.tenantId,
      );
      client.emit('drivers:initial', drivers);
    } catch {
      console.log(`❌ Unauthorized connection: ${client.id}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.connectedClients.delete(client.id);
    console.log(`👋 Client disconnected: ${client.id}`);
  }

  // ─── Events from Client ───────────────────────────────

  @SubscribeMessage('driver:subscribe')
  async subscribeToDriver(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { driverId: string },
  ) {
    // Subscribe the admin to updates for a specific driver.
    client.join(`driver:${data.driverId}`);
    client.emit('subscribed', { driverId: data.driverId });
  }

  @SubscribeMessage('driver:unsubscribe')
  unsubscribeFromDriver(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { driverId: string },
  ) {
    client.leave(`driver:${data.driverId}`);
  }

  // ─── Emit to clients (called by DriversService) ───────

  emitDriverLocationUpdate(
    tenantId: string,
    driverData: {
      id: string;
      name: string;
      status: string;
      currentLat: number;
      currentLng: number;
      lastLocationAt: Date;
    },
  ) {
    // Send updates to all admins for this tenant.
    this.server
      .to(`tenant:${tenantId}`)
      .emit('driver:location_updated', driverData);

    // Send updates to clients subscribed to this specific driver.
    this.server
      .to(`driver:${driverData.id}`)
      .emit('driver:location_updated', driverData);
  }

  emitOrderStatusUpdate(
    tenantId: string,
    orderData: {
      id: string;
      trackingCode: string;
      status: string;
      driverId?: string;
    },
  ) {
    this.server
      .to(`tenant:${tenantId}`)
      .emit('order:status_updated', orderData);
  }
}
