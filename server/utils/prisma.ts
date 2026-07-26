import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../generated/prisma/client'
import { resolvePrismaConnectionString } from './database-url'

const connectionString = resolvePrismaConnectionString(process.env)

const adapter = new PrismaPg({ connectionString })

export const prisma = new PrismaClient({ adapter })
