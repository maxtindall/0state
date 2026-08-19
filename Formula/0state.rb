class Zerostate < Formula
  desc "0state terminal — a CityDAO-style commune; citizenship is a transferable Citizen NFT"
  homepage "https://0state.website"
  url "https://github.com/maxtindall/0state/archive/refs/tags/cli-v3.0.0.tar.gz"
  sha256 "3c552f1e2fde6b142976e0e61fdae6f7773e15bcab7cf482fc376d6fc00c85d2"
  license "MIT"

  depends_on "node"

  def install
    cd "cli" do
      system "npm", "install"
      libexec.install Dir["*"]
    end
    # the terminal
    (bin/"0state").write <<~SH
      #!/bin/bash
      exec "#{Formula["node"].opt_bin}/node" "#{libexec}/0state.mjs" "$@"
    SH
    # the STATE miner — mine STATE to earn 0state citizenship
    (bin/"statemine").write <<~SH
      #!/bin/bash
      exec "#{Formula["node"].opt_bin}/node" "#{libexec}/mine.mjs" "$@"
    SH
  end

  test do
    assert_match "0state", shell_output("#{bin}/0state help")
  end
end
