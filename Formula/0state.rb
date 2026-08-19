class Zerostate < Formula
  desc "Terminal and STATE miner for 0state — a communist DAO of the miners of STATE"
  homepage "https://0state.website"
  url "https://github.com/maxtindall/0state/archive/refs/tags/cli-v2.0.0.tar.gz"
  sha256 "8f3b0b2d469fb84a0640cc20b29e97fc48e25e79f3a34e0612bd5199bd3b0235"
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
