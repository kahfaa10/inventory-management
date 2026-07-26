import { describe, expect, it } from 'vitest'
import { prisma, withCleanDatabase } from '../helpers/database'

describe('inventory schema', () => {
  it('rejects duplicate null-DPN details within the same device', async () => {
    await withCleanDatabase(async () => {
      const device = await prisma.device.create({ data: { deviceName: 'Disk' } })
      await prisma.deviceDetail.create({
        data: { deviceId: device.id, partNumber: 'PN-1', specification: '600GB' },
      })
      await expect(
        prisma.deviceDetail.create({
          data: { deviceId: device.id, partNumber: 'PN-1', specification: 'Other' },
        }),
      ).rejects.toMatchObject({ code: 'P2002' })
    })
  })
})
