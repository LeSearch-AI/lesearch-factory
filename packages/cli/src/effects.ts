export type CommandResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export interface DockerRunner {
  compose(args: string[]): Promise<CommandResult>;
  info(): Promise<CommandResult>;
  psQuiet(): Promise<string[]>;
}

export interface FileSystemEffects {
  exists(path: string): Promise<boolean>;
  remove(path: string): Promise<void>;
  writableDir(path: string): Promise<boolean>;
}

export interface Effects {
  docker: DockerRunner;
  fs: FileSystemEffects;
  repoRoot: string;
  paths: {
    binaryPath: string;
    configDir: string;
    dataVolume: string;
    gatewayUrl: string;
    statusUrl: string;
    webUiUrl: string;
    installDir: string;
  };
  portIsFree(port: number): Promise<boolean>;
  fetchStatus(url: string): Promise<unknown>;
  readPackageVersion(): Promise<string>;
  log(line: string): void;
  errorLog(line: string): void;
}

export function realEffects(): Effects {
  throw new Error("realEffects is not implemented");
}
