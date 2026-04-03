export interface RemoteDbBuildFileConfig {
  enabled?: boolean;
  configurable?: boolean;
  baseUrl?: string | null;
}

const remoteDbBuildConfig: RemoteDbBuildFileConfig = {
  enabled: true,
  configurable: true,
  baseUrl: '',
};

export default remoteDbBuildConfig;
