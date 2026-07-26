import { describe, expect, it } from 'vitest'
import config from '../../vitest.config'

describe('Vitest configuration', () => {
  it('resolves the Nuxt project through the Nuxt test-utils helper', async () => {
    const projects = await Promise.all(config.test?.projects ?? [])
    const nuxtProject = projects.find((project) => project.test?.name === 'nuxt')
    const nuxtHttpProject = projects.find((project) => project.test?.name === 'nuxt-http')
    const integrationProject = projects.find((project) => project.test?.name === 'integration')

    expect(projects.map((project) => project.test?.name)).toEqual([
      'unit',
      'nuxt',
      'nuxt-http',
      'integration',
    ])
    expect(projects[0]?.test?.include).toEqual(['tests/unit/**/*.{test,spec}.ts'])
    expect(nuxtProject?.test?.environment).toBe('nuxt')
    expect(nuxtProject?.test?.include).toEqual(['tests/nuxt/**/*.{test,spec}.ts'])
    expect(nuxtProject?.test?.exclude).toEqual([
      'tests/nuxt/auth-routes.test.ts',
      'tests/nuxt/master-api.test.ts',
      'tests/nuxt/stock-balance-api.test.ts',
    ])
    expect(nuxtHttpProject?.test?.environment).toBe('node')
    expect(nuxtHttpProject?.test?.include).toEqual([
      'tests/nuxt/auth-routes.test.ts',
      'tests/nuxt/master-api.test.ts',
      'tests/nuxt/stock-balance-api.test.ts',
    ])
    expect(integrationProject?.test?.include).toEqual(['tests/integration/**/*.{test,spec}.ts'])
    expect(nuxtProject?.plugins).not.toHaveLength(0)
    expect(nuxtProject?.test?.setupFiles).toEqual(
      expect.arrayContaining([expect.stringMatching(/@nuxt\/test-utils.*runtime\/entry/)]),
    )
  })
})
