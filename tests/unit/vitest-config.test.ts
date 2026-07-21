import { describe, expect, it } from 'vitest'
import config from '../../vitest.config'

describe('Vitest configuration', () => {
  it('resolves the Nuxt project through the Nuxt test-utils helper', async () => {
    const projects = await Promise.all(config.test?.projects ?? [])
    const nuxtProject = projects.find((project) => project.test?.name === 'nuxt')

    expect(projects.map((project) => project.test?.name)).toEqual(['unit', 'nuxt', 'integration'])
    expect(projects[0]?.test?.include).toEqual(['tests/unit/**/*.{test,spec}.ts'])
    expect(nuxtProject?.test?.environment).toBe('nuxt')
    expect(nuxtProject?.test?.include).toEqual(['tests/nuxt/**/*.{test,spec}.ts'])
    expect(projects[2]?.test?.include).toEqual(['tests/integration/**/*.{test,spec}.ts'])
    expect(nuxtProject?.plugins).not.toHaveLength(0)
    expect(nuxtProject?.test?.setupFiles).toEqual(
      expect.arrayContaining([expect.stringMatching(/@nuxt\/test-utils.*runtime\/entry/)]),
    )
  })
})
